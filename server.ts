import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { users, restaurants, programs, customers, visits, employees, services, appointments } from "./src/db/schema.ts";
import { eq, and, gt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure user exists in SQL DB helper
  const syncUser = async (uid: string, email?: string) => {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length === 0) {
      await db.insert(users).values({ uid, email: email || '' });
    }
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get restaurant for logged in user
  app.get("/api/restaurant", requireAuth, async (req: AuthRequest, res) => {
    try {
      await syncUser(req.user!.uid, req.user!.email);
      const rest = await db.select().from(restaurants).where(eq(restaurants.ownerUid, req.user!.uid));
      res.json(rest.length > 0 ? rest[0] : null);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurant", requireAuth, async (req: AuthRequest, res) => {
    try {
      await syncUser(req.user!.uid, req.user!.email);
      const { name } = req.body;
      const result = await db.insert(restaurants).values({ name, ownerUid: req.user!.uid }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/restaurants/:id/programs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const progs = await db.select().from(programs).where(eq(programs.restaurantId, parseInt(req.params.id)));
      res.json(progs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurants/:id/programs", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, visitsRequired, rewardDescription } = req.body;
      const result = await db.insert(programs).values({
        restaurantId: parseInt(req.params.id),
        name,
        visitsRequired,
        rewardDescription
      }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/restaurants/:id/customers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const custs = await db.select().from(customers).where(eq(customers.restaurantId, parseInt(req.params.id)));
      res.json(custs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurants/:id/customers", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, phone, programId } = req.body;
      const id = "CARD-" + Math.random().toString(36).substr(2, 6).toUpperCase(); // generate ID
      const result = await db.insert(customers).values({
        id,
        restaurantId: parseInt(req.params.id),
        name,
        phone,
        programId: parseInt(programId),
      }).returning();
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

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

      // Check double scan
      const today = new Date();
      today.setHours(0,0,0,0);
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
        restaurantId: customer.restaurantId,
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
      await db.update(customers).set({ visits: 0, rewardStatus: "pending" }).where(eq(customers.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/restaurants/:id/employees", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const e = await db.select().from(employees).where(eq(employees.restaurantId, restId));
      res.json(e);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurants/:id/employees", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const newEmp = await db.insert(employees).values({
        restaurantId: restId,
        ...req.body
      }).returning();
      res.json(newEmp[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/restaurants/:id/services", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const svcs = await db.select().from(services).where(eq(services.restaurantId, restId));
      res.json(svcs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurants/:id/services", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const newSvc = await db.insert(services).values({
        restaurantId: restId,
        ...req.body
      }).returning();
      res.json(newSvc[0]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/restaurants/:id/appointments", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const apts = await db.select().from(appointments).where(eq(appointments.restaurantId, restId));
      res.json(apts);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/restaurants/:id/appointments", requireAuth, async (req, res) => {
    try {
      const restId = parseInt(req.params.id);
      const newApt = await db.insert(appointments).values({
        restaurantId: restId,
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime)
      }).returning();
      res.json(newApt[0]);
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
