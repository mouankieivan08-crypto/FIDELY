import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { supabase } from "./src/lib/supabase-server.ts";
import { toSnakeCase, toCamelCase, toCamelCaseArray } from "./src/lib/caseConvert.ts";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" })); // selfies are base64-encoded images

  const syncUser = async (uid: string, email?: string) => {
    const existing = unwrap(await supabase.from("users").select("id").eq("uid", uid).limit(1));
    if (!existing || existing.length === 0) {
      unwrap(await supabase.from("users").insert({ uid, email: email || "" }));
    }
  };

  // Loads the business for :id and 403s if it isn't owned by the caller.
  const loadOwnedBusiness = async (req: AuthRequest, res: express.Response, businessId: number) => {
    if (Number.isNaN(businessId)) {
      res.status(400).json({ error: "Invalid business id" });
      return null;
    }
    const rows = unwrap(await supabase.from("businesses").select("*").eq("id", businessId).limit(1));
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Business not found" });
      return null;
    }
    const business = toCamelCase<{ ownerUid: string }>(rows[0]);
    if (business.ownerUid !== req.user!.uid) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }
    return business;
  };

  const requireOwnedBusiness = async (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const businessId = parseInt(req.params.id);
    const business = await loadOwnedBusiness(req, res, businessId);
    if (!business) return; // response already sent
    (req as any).business = business;
    next();
  };

  const handleZodError = (res: express.Response, error: z.ZodError) => {
    res.status(400).json({ error: error.issues.map((i) => i.message).join(", ") });
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get business for logged in user
  app.get("/api/business", requireAuth, async (req: AuthRequest, res) => {
    try {
      await syncUser(req.user!.uid, req.user!.email);
      const rows = unwrap(await supabase.from("businesses").select("*").eq("owner_uid", req.user!.uid).limit(1));
      res.json(rows && rows.length > 0 ? toCamelCase(rows[0]) : null);
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
      const result = unwrap(
        await supabase.from("businesses").insert({ name: parsed.data.name, owner_uid: req.user!.uid }).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/programs", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("programs").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
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
      const result = unwrap(
        await supabase
          .from("programs")
          .insert({
            business_id: parseInt(req.params.id),
            name: parsed.data.name,
            visits_required: parsed.data.visitsRequired,
            reward_description: parsed.data.rewardDescription,
          })
          .select()
          .single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/customers", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("customers").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
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
      const businessId = parseInt(req.params.id);

      // programId must belong to this business
      const prog = unwrap(
        await supabase.from("programs").select("id").eq("id", parsed.data.programId).eq("business_id", businessId)
      );
      if (!prog || prog.length === 0) return res.status(400).json({ error: "Invalid program" });

      // Cryptographically random, unguessable card id (public card URLs rely on this being unenumerable)
      const id = "CARD-" + randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
      const result = unwrap(
        await supabase
          .from("customers")
          .insert({
            id,
            business_id: businessId,
            name: parsed.data.name,
            phone: parsed.data.phone,
            program_id: parsed.data.programId,
          })
          .select()
          .single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Public: powers the shareable /card/:id loyalty card page (no login for customers).
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const rows = unwrap(await supabase.from("customers").select("*").eq("id", req.params.id).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(toCamelCase(rows[0]));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/customers/:id/visits", requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerId = req.params.id;

      const custs = unwrap(await supabase.from("customers").select("*").eq("id", customerId).limit(1));
      if (!custs || custs.length === 0) return res.status(404).json({ error: "Customer not found" });
      const customer = toCamelCase<{ businessId: number; programId: number; visits: number; rewardStatus: string }>(custs[0]);

      const business = await loadOwnedBusiness(req, res, customer.businessId);
      if (!business) return; // response already sent

      // Check double scan
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recentVisits = unwrap(
        await supabase.from("visits").select("id").eq("customer_id", customerId).gt("date", today.toISOString())
      );
      if (recentVisits && recentVisits.length > 0) {
        return res.status(400).json({ error: "Customer already visited today." });
      }

      const progs = unwrap(await supabase.from("programs").select("*").eq("id", customer.programId).limit(1));
      if (!progs || progs.length === 0) return res.status(404).json({ error: "Program not found" });
      const program = toCamelCase<{ visitsRequired: number }>(progs[0]);

      // add visit
      unwrap(
        await supabase.from("visits").insert({
          customer_id: customerId,
          business_id: customer.businessId,
          validated_by: req.user!.uid,
        })
      );

      const newVisits = customer.visits + 1;
      let newRewardStatus = customer.rewardStatus;
      if (newVisits >= program.visitsRequired) {
        newRewardStatus = "available";
      }

      unwrap(
        await supabase.from("customers").update({ visits: newVisits, reward_status: newRewardStatus }).eq("id", customerId)
      );

      res.json({ newVisits, newRewardStatus });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Public: powers the shareable /card/:id loyalty card page (no login for customers).
  app.get("/api/customers/:id/visits", async (req, res) => {
    try {
      const rows = unwrap(await supabase.from("visits").select("*").eq("customer_id", req.params.id));
      res.json(toCamelCaseArray(rows || []));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/customers/:id/redeem", requireAuth, async (req: AuthRequest, res) => {
    try {
      const custs = unwrap(await supabase.from("customers").select("*").eq("id", req.params.id).limit(1));
      if (!custs || custs.length === 0) return res.status(404).json({ error: "Customer not found" });
      const customer = toCamelCase<{ businessId: number }>(custs[0]);

      const business = await loadOwnedBusiness(req, res, customer.businessId);
      if (!business) return; // response already sent

      unwrap(await supabase.from("customers").update({ visits: 0, reward_status: "pending" }).eq("id", req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/employees", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("employees").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
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
      const result = unwrap(
        await supabase
          .from("employees")
          .insert({
            business_id: parseInt(req.params.id),
            name: parsed.data.name,
            role: parsed.data.role,
            phone: parsed.data.phone,
            avatar_url: parsed.data.avatarUrl,
          })
          .select()
          .single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/services", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("services").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
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
      const result = unwrap(
        await supabase
          .from("services")
          .insert({
            business_id: parseInt(req.params.id),
            name: parsed.data.name,
            category: parsed.data.category,
            price: parsed.data.price,
            duration: parsed.data.duration,
            description: parsed.data.description,
          })
          .select()
          .single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/businesses/:id/appointments", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("appointments").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
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
      const result = unwrap(
        await supabase
          .from("appointments")
          .insert(
            toSnakeCase({
              businessId: parseInt(req.params.id),
              customerId: parsed.data.customerId,
              employeeId: parsed.data.employeeId,
              serviceId: parsed.data.serviceId,
              startTime: parsed.data.startTime,
              endTime: parsed.data.endTime,
              status: parsed.data.status ?? "scheduled",
            })
          )
          .select()
          .single()
      );
      res.json(toCamelCase(result));
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
      const emp = unwrap(await supabase.from("employees").select("*").eq("id", empId).limit(1));
      if (!emp || emp.length === 0) return res.status(404).json({ error: "Employee not found" });
      const employee = toCamelCase<{ businessId: number }>(emp[0]);

      const business = await loadOwnedBusiness(req, res, employee.businessId);
      if (!business) return; // response already sent

      const parsed = clockSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const openLog = unwrap(
        await supabase.from("time_logs").select("id").eq("employee_id", empId).is("clock_out_time", null)
      );
      if (openLog && openLog.length > 0) {
        return res.status(400).json({ error: "Employee is already clocked in." });
      }

      const result = unwrap(
        await supabase
          .from("time_logs")
          .insert(
            toSnakeCase({
              employeeId: empId,
              clockInTime: new Date(),
              selfieUrl: parsed.data.selfieUrl,
              locationLat: parsed.data.locationLat,
              locationLng: parsed.data.locationLng,
            })
          )
          .select()
          .single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/employees/:id/clock-out", requireAuth, async (req: AuthRequest, res) => {
    try {
      const empId = parseInt(req.params.id);
      const emp = unwrap(await supabase.from("employees").select("*").eq("id", empId).limit(1));
      if (!emp || emp.length === 0) return res.status(404).json({ error: "Employee not found" });
      const employee = toCamelCase<{ businessId: number }>(emp[0]);

      const business = await loadOwnedBusiness(req, res, employee.businessId);
      if (!business) return; // response already sent

      const openLog = unwrap(
        await supabase.from("time_logs").select("id").eq("employee_id", empId).is("clock_out_time", null)
      );
      if (!openLog || openLog.length === 0) {
        return res.status(400).json({ error: "Employee is not clocked in." });
      }

      const result = unwrap(
        await supabase.from("time_logs").update({ clock_out_time: new Date().toISOString() }).eq("id", openLog[0].id).select().single()
      );
      res.json(toCamelCase(result));
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
