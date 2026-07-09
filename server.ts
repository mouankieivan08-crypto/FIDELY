import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { z } from "zod";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { users, businesses, programs, customers, visits, employees, services, appointments, timeLogs } from "./src/db/schema.ts";
import { eq, and, gt, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" })); // selfies are base64-encoded images

  // Ensure user exists in SQL DB helper
  const syncUser = async (uid: string, email?: string) => {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length === 0) {
      await db.insert(users).values({ uid, email: email || '' });
    }
  };

  // Loads the business for :id and 403s if it isn't owned by the caller.
  const loadOwnedBusiness = async (req: AuthRequest, res: express.Response, businessId: number) => {
    if (Number.isNaN(businessId)) {
      res.status(400).json({ error: "Invalid business id" });
      return null;
    }
    const rows = await db.select().from(businesses).where(eq(businesses.id, businessId));
    if (rows.length === 0) {
      res.status(404).json({ error: "Business not found" });
      return null;
    }
    if (rows[0].ownerUid !== req.user!.uid) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }
    return rows[0];
  };

  const requireOwnedBusiness = async (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const restId = parseInt(req.params.id);
    const rest = await loadOwnedBusiness(req, res, restId);
    if (!rest) return; // response already sent
    (req as any).business = rest;
    next();
  };

  const handleZodError = (res: express.Response, error: z.ZodError) => {
    res.status(400).json({ error: error.issues.map(i => i.message).join(", ") });
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get business for logged in user
  app.get("/api/business", requireAuth, async (req: AuthRequest, res) => {
    try {
      await syncUser(req.user!.uid, req.user!.email);
      const rest = await db.select().from(businesses).where(eq(businesses.ownerUid, req.user!.uid));
      res.json(rest.length > 0 ? rest[0] : null);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createBusinessSchema = z.object({ name: z.string().trim().min(1).max(200) });

  app.post("/api/business", requireAuth, async (req: AuthRequest, res) => {
    try {
      const parsed = createBusinessSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      await syncUser(req.user!.uid, req.user!.email);
      const result = await db.insert(businesses).values({ name: parsed.data.name, ownerUid: req.user!.uid }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/programs", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const progs = await db.select().from(programs).where(eq(programs.businessId, parseInt(req.params.id)));
      res.json(progs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createProgramSchema = z.object({
    name: z.string().trim().min(1).max(200),
    visitsRequired: z.coerce.number().int().min(1).max(1000),
    rewardDescription: z.string().trim().min(1).max(500),
  });

  app.post("/api/businesses/:id/programs", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createProgramSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = await db.insert(programs).values({
        businessId: parseInt(req.params.id),
        name: parsed.data.name,
        visitsRequired: parsed.data.visitsRequired,
        rewardDescription: parsed.data.rewardDescription,
      }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/customers", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const custs = await db.select().from(customers).where(eq(customers.businessId, parseInt(req.params.id)));
      res.json(custs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createCustomerSchema = z.object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().min(1).max(30),
    programId: z.coerce.number().int().positive(),
  });

  app.post("/api/businesses/:id/customers", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const restId = parseInt(req.params.id);

      // programId must belong to this business
      const prog = await db.select().from(programs).where(
        and(eq(programs.id, parsed.data.programId), eq(programs.businessId, restId))
      );
      if (prog.length === 0) return res.status(400).json({ error: "Invalid program" });

      // Cryptographically random, unguessable card id (public card URLs rely on this being unenumerable)
      const id = "CARD-" + randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
      const result = await db.insert(customers).values({
        id,
        businessId: restId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        programId: parsed.data.programId,
      }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Public: powers the shareable /card/:id loyalty card page (no login for customers).
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const cust = await db.select().from(customers).where(eq(customers.id, req.params.id));
      if (cust.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(cust[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/customers/:id/visits", requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerId = req.params.id;

      const custs = await db.select().from(customers).where(eq(customers.id, customerId));
      if (custs.length === 0) return res.status(404).json({ error: "Customer not found" });
      const customer = custs[0];

      const rest = await loadOwnedBusiness(req, res, customer.businessId);
      if (!rest) return; // response already sent

      // Check double scan
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recentVisits = await db.select().from(visits).where(
        and(eq(visits.customerId, customerId), gt(visits.date, today))
      );
      if (recentVisits.length > 0) {
        return res.status(400).json({ error: "Customer already visited today." });
      }

      const progs = await db.select().from(programs).where(eq(programs.id, customer.programId));
      if (progs.length === 0) return res.status(404).json({ error: "Program not found" });
      const program = progs[0];

      // add visit
      await db.insert(visits).values({
        customerId,
        businessId: customer.businessId,
        validatedBy: req.user!.uid,
      });

      const newVisits = customer.visits + 1;
      let newRewardStatus = customer.rewardStatus;
      if (newVisits >= program.visitsRequired) {
        newRewardStatus = "available";
      }

      await db.update(customers).set({ visits: newVisits, rewardStatus: newRewardStatus }).where(eq(customers.id, customerId));

      res.json({ newVisits, newRewardStatus });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Public: powers the shareable /card/:id loyalty card page (no login for customers).
  app.get("/api/customers/:id/visits", async (req, res) => {
    try {
      const v = await db.select().from(visits).where(eq(visits.customerId, req.params.id));
      res.json(v);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/customers/:id/redeem", requireAuth, async (req: AuthRequest, res) => {
    try {
      const custs = await db.select().from(customers).where(eq(customers.id, req.params.id));
      if (custs.length === 0) return res.status(404).json({ error: "Customer not found" });

      const rest = await loadOwnedBusiness(req, res, custs[0].businessId);
      if (!rest) return; // response already sent

      await db.update(customers).set({ visits: 0, rewardStatus: "pending" }).where(eq(customers.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/employees", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const restId = parseInt(req.params.id);
      const e = await db.select().from(employees).where(eq(employees.businessId, restId));
      res.json(e);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createEmployeeSchema = z.object({
    name: z.string().trim().min(1).max(200),
    role: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(30).optional(),
    avatarUrl: z.string().max(2_000_000).optional(),
  });

  app.post("/api/businesses/:id/employees", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createEmployeeSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const restId = parseInt(req.params.id);
      const newEmp = await db.insert(employees).values({
        businessId: restId,
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        avatarUrl: parsed.data.avatarUrl,
      }).returning();
      res.json(newEmp[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/services", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const restId = parseInt(req.params.id);
      const svcs = await db.select().from(services).where(eq(services.businessId, restId));
      res.json(svcs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createServiceSchema = z.object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().max(100).optional(),
    price: z.coerce.number().int().min(0),
    duration: z.coerce.number().int().min(1).max(1440),
    description: z.string().trim().max(1000).optional(),
  });

  app.post("/api/businesses/:id/services", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createServiceSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const restId = parseInt(req.params.id);
      const newSvc = await db.insert(services).values({
        businessId: restId,
        name: parsed.data.name,
        category: parsed.data.category,
        price: parsed.data.price,
        duration: parsed.data.duration,
        description: parsed.data.description,
      }).returning();
      res.json(newSvc[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/appointments", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const restId = parseInt(req.params.id);
      const apts = await db.select().from(appointments).where(eq(appointments.businessId, restId));
      res.json(apts);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createAppointmentSchema = z.object({
    customerId: z.string().trim().min(1),
    employeeId: z.coerce.number().int().positive().optional(),
    serviceId: z.coerce.number().int().positive(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    status: z.enum(["scheduled", "completed", "cancelled", "in_progress"]).optional(),
  });

  app.post("/api/businesses/:id/appointments", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createAppointmentSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      if (parsed.data.endTime <= parsed.data.startTime) {
        return res.status(400).json({ error: "endTime must be after startTime" });
      }
      const restId = parseInt(req.params.id);
      const newApt = await db.insert(appointments).values({
        businessId: restId,
        customerId: parsed.data.customerId,
        employeeId: parsed.data.employeeId,
        serviceId: parsed.data.serviceId,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        status: parsed.data.status ?? "scheduled",
      }).returning();
      res.json(newApt[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Employee time clock ---

  const clockSchema = z.object({
    selfieUrl: z.string().max(2_000_000).optional(),
    locationLat: z.string().max(50).optional(),
    locationLng: z.string().max(50).optional(),
  });

  app.post("/api/employees/:id/clock-in", requireAuth, async (req: AuthRequest, res) => {
    try {
      const empId = parseInt(req.params.id);
      const emp = await db.select().from(employees).where(eq(employees.id, empId));
      if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });

      const rest = await loadOwnedBusiness(req, res, emp[0].businessId);
      if (!rest) return; // response already sent

      const parsed = clockSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const openLog = await db.select().from(timeLogs).where(
        and(eq(timeLogs.employeeId, empId), isNull(timeLogs.clockOutTime))
      );
      if (openLog.length > 0) {
        return res.status(400).json({ error: "Employee is already clocked in." });
      }

      const result = await db.insert(timeLogs).values({
        employeeId: empId,
        clockInTime: new Date(),
        selfieUrl: parsed.data.selfieUrl,
        locationLat: parsed.data.locationLat,
        locationLng: parsed.data.locationLng,
      }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/employees/:id/clock-out", requireAuth, async (req: AuthRequest, res) => {
    try {
      const empId = parseInt(req.params.id);
      const emp = await db.select().from(employees).where(eq(employees.id, empId));
      if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });

      const rest = await loadOwnedBusiness(req, res, emp[0].businessId);
      if (!rest) return; // response already sent

      const openLog = await db.select().from(timeLogs).where(
        and(eq(timeLogs.employeeId, empId), isNull(timeLogs.clockOutTime))
      );
      if (openLog.length === 0) {
        return res.status(400).json({ error: "Employee is not clocked in." });
      }

      const result = await db.update(timeLogs).set({ clockOutTime: new Date() })
        .where(eq(timeLogs.id, openLog[0].id)).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
