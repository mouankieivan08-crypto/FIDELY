import express from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAuth, AuthRequest } from "./middleware/auth.js";
import { supabase } from "./lib/supabase-server.js";
import { toSnakeCase, toCamelCase, toCamelCaseArray } from "./lib/caseConvert.js";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// Builds the Express app with all /api routes. Shared by the local dev server
// (server.ts) and the Vercel serverless handler (api/index.ts). It does NOT
// call listen() or serve static/Vite assets — those are environment-specific.
export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: "5mb" })); // selfies are base64-encoded images

  const syncUser = async (uid: string, email?: string) => {
    const existing = unwrap(await supabase.from("users").select("id").eq("uid", uid).limit(1));
    if (!existing || existing.length === 0) {
      unwrap(await supabase.from("users").insert({ uid, email: email || "" }));
    }
  };

  // Resolves the caller's access to a business. Returns the business plus the
  // caller's role ('admin' if owner or admin member, else 'staff'), or null
  // after sending the appropriate error response.
  const loadAccess = async (
    req: AuthRequest,
    res: express.Response,
    businessId: number
  ): Promise<{ business: any; role: string } | null> => {
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
    if (business.ownerUid === req.user!.uid) return { business, role: "admin" };

    const mem = unwrap(await supabase.from("members").select("*").eq("business_id", businessId));
    const member = (mem || []).map((m) => toCamelCase<{ uid: string; email: string; role: string }>(m))
      .find((m) => m.uid === req.user!.uid || m.email === req.user!.email);
    if (member) return { business, role: member.role };

    res.status(403).json({ error: "Forbidden" });
    return null;
  };

  // Back-compat: returns the business if the caller is owner or member, else null.
  const loadOwnedBusiness = async (req: AuthRequest, res: express.Response, businessId: number) => {
    const access = await loadAccess(req, res, businessId);
    return access ? access.business : null;
  };

  const requireOwnedBusiness = async (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const access = await loadAccess(req, res, parseInt(req.params.id));
    if (!access) return; // response already sent
    (req as any).business = access.business;
    (req as any).role = access.role;
    next();
  };

  // Admin-only gate (owner or member with role 'admin').
  const requireAdmin = async (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const access = await loadAccess(req, res, parseInt(req.params.id));
    if (!access) return; // response already sent
    if (access.role !== "admin") {
      res.status(403).json({ error: "Réservé aux administrateurs" });
      return;
    }
    (req as any).business = access.business;
    (req as any).role = access.role;
    next();
  };

  const handleZodError = (res: express.Response, error: z.ZodError) => {
    res.status(400).json({ error: error.issues.map((i) => i.message).join(", ") });
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get business for logged in user (as owner, or as an invited staff member)
  app.get("/api/business", requireAuth, async (req: AuthRequest, res) => {
    try {
      await syncUser(req.user!.uid, req.user!.email);

      // Owner?
      const owned = unwrap(await supabase.from("businesses").select("*").eq("owner_uid", req.user!.uid).limit(1));
      if (owned && owned.length > 0) {
        res.json({ ...toCamelCase(owned[0]), role: "admin" });
        return;
      }

      // Invited member? (match by uid, else by email)
      let mem = unwrap(await supabase.from("members").select("*").eq("uid", req.user!.uid).limit(1));
      if ((!mem || mem.length === 0) && req.user!.email) {
        mem = unwrap(await supabase.from("members").select("*").eq("email", req.user!.email).limit(1));
        // Link this login to the membership for future lookups
        if (mem && mem.length > 0 && !mem[0].uid) {
          unwrap(await supabase.from("members").update({ uid: req.user!.uid }).eq("id", mem[0].id));
        }
      }
      if (mem && mem.length > 0) {
        const member = toCamelCase<{ businessId: number; role: string }>(mem[0]);
        const biz = unwrap(await supabase.from("businesses").select("*").eq("id", member.businessId).limit(1));
        if (biz && biz.length > 0) {
          res.json({ ...toCamelCase(biz[0]), role: member.role });
          return;
        }
      }

      res.json(null);
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
      // Application mono-client : une seule entreprise autorisée.
      const anyBiz = unwrap(await supabase.from("businesses").select("id").limit(1));
      if (anyBiz && anyBiz.length > 0) {
        return res.status(403).json({ error: "Une entreprise existe déjà sur cette application." });
      }
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

      // Short, human-readable card number for search/display (e.g. "D4451"), unique per business
      let cardNumber = "";
      for (let i = 0; i < 12; i++) {
        const letter = "ABCDEFGHJKLMNPRSTUVWXYZ"[Math.floor(Math.random() * 22)];
        const candidate = letter + Math.floor(1000 + Math.random() * 9000);
        const clash = unwrap(await supabase.from("customers").select("id").eq("business_id", businessId).eq("card_number", candidate).limit(1));
        if (!clash || clash.length === 0) { cardNumber = candidate; break; }
      }

      const result = unwrap(
        await supabase
          .from("customers")
          .insert({
            id,
            business_id: businessId,
            name: parsed.data.name,
            phone: parsed.data.phone,
            program_id: parsed.data.programId,
            card_number: cardNumber,
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

  const validateVisitSchema = z.object({
    serviceId: z.coerce.number().int().positive().optional(),
    variantId: z.coerce.number().int().positive().optional(),
  });

  app.post("/api/customers/:id/visits", requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerId = req.params.id;
      const parsed = validateVisitSchema.safeParse(req.body || {});
      if (!parsed.success) return handleZodError(res, parsed.error);

      const custs = unwrap(await supabase.from("customers").select("*").eq("id", customerId).limit(1));
      if (!custs || custs.length === 0) return res.status(404).json({ error: "Customer not found" });
      const customer = toCamelCase<{ businessId: number; programId: number; visits: number; points: number; rewardStatus: string }>(custs[0]);

      const business = await loadOwnedBusiness(req, res, customer.businessId);
      if (!business) return; // response already sent

      // Guard against accidental double validation (same customer within the last 60s)
      const recent = unwrap(
        await supabase.from("visits").select("id").eq("customer_id", customerId)
          .gt("date", new Date(Date.now() - 60_000).toISOString())
      );
      if (recent && recent.length > 0) {
        return res.status(400).json({ error: "Visite déjà validée à l'instant. Patientez un instant." });
      }

      // Resolve the performed service / variant → amount + points (1 point / 1000 FCFA)
      let serviceId: number | null = null;
      let serviceName: string | null = null;
      let amountFcfa = 0;
      if (parsed.data.variantId) {
        const vr = unwrap(await supabase.from("service_variants").select("*").eq("id", parsed.data.variantId).limit(1));
        if (vr && vr.length > 0) {
          const variant = toCamelCase<{ serviceId: number; name: string; price: number }>(vr[0]);
          serviceId = variant.serviceId;
          amountFcfa = Math.round(variant.price / 100);
          const sv = unwrap(await supabase.from("services").select("name").eq("id", variant.serviceId).limit(1));
          serviceName = (sv && sv[0]?.name ? sv[0].name + " — " : "") + variant.name;
        }
      } else if (parsed.data.serviceId) {
        const sv = unwrap(await supabase.from("services").select("*").eq("id", parsed.data.serviceId).eq("business_id", customer.businessId).limit(1));
        if (sv && sv.length > 0) {
          const service = toCamelCase<{ id: number; name: string; price: number }>(sv[0]);
          serviceId = service.id;
          serviceName = service.name;
          amountFcfa = Math.round(service.price / 100);
        }
      }
      const earnedPoints = Math.round(amountFcfa / 1000);

      const progs = unwrap(await supabase.from("programs").select("*").eq("id", customer.programId).limit(1));
      const program = progs && progs.length > 0 ? toCamelCase<{ visitsRequired: number }>(progs[0]) : { visitsRequired: 999999 };

      // Record the visit with full detail (anti-fraud: who, when, what, how much)
      unwrap(
        await supabase.from("visits").insert(toSnakeCase({
          customerId,
          businessId: customer.businessId,
          serviceId,
          serviceName,
          amount: amountFcfa || null,
          points: earnedPoints,
          validatedBy: req.user!.uid,
        }))
      );

      const newVisits = customer.visits + 1;
      const newPoints = (customer.points || 0) + earnedPoints;
      let newRewardStatus = customer.rewardStatus;
      if (newVisits >= program.visitsRequired) {
        newRewardStatus = "available";
      }

      unwrap(
        await supabase.from("customers").update({ visits: newVisits, points: newPoints, reward_status: newRewardStatus }).eq("id", customerId)
      );

      res.json({ newVisits, newPoints, earnedPoints, serviceName, amount: amountFcfa, newRewardStatus });
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

  app.post("/api/businesses/:id/employees", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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

  // Delete an employee (admin only). Cleans up dependent rows first.
  app.delete("/api/employees/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const empId = parseInt(req.params.id);
      const rows = unwrap(await supabase.from("employees").select("*").eq("id", empId).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const employee = toCamelCase<{ businessId: number }>(rows[0]);
      const access = await loadAccess(req, res, employee.businessId);
      if (!access) return;
      if (access.role !== "admin") return res.status(403).json({ error: "Réservé aux administrateurs" });
      // Remove dependent rows / references before deleting
      unwrap(await supabase.from("time_logs").delete().eq("employee_id", empId));
      unwrap(await supabase.from("appointments").update({ employee_id: null }).eq("employee_id", empId));
      unwrap(await supabase.from("employees").delete().eq("id", empId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Clock-in / clock-out history for the whole business (admin only, traçabilité)
  app.get("/api/businesses/:id/time-logs", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const emps = unwrap(await supabase.from("employees").select("id, name").eq("business_id", businessId));
      const empIds = (emps || []).map((e: any) => e.id);
      if (empIds.length === 0) return res.json([]);
      const logs = unwrap(
        await supabase.from("time_logs").select("*").in("employee_id", empIds).order("clock_in_time", { ascending: false }).limit(500)
      );
      const nameById: Record<number, string> = {};
      (emps || []).forEach((e: any) => { nameById[e.id] = e.name; });
      const enriched = (logs || []).map((l: any) => ({ ...toCamelCase(l), employeeName: nameById[l.employee_id] || "—" }));
      res.json(enriched);
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

  // --- Service categories ---

  app.get("/api/businesses/:id/categories", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("categories").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createCategorySchema = z.object({ name: z.string().trim().min(1).max(100) });

  app.post("/api/businesses/:id/categories", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createCategorySchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = unwrap(
        await supabase.from("categories").insert({ business_id: parseInt(req.params.id), name: parsed.data.name }).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Service variants ---

  // Loads a service and verifies the caller can access its business.
  const loadServiceAccess = async (req: AuthRequest, res: express.Response, serviceId: number) => {
    const rows = unwrap(await supabase.from("services").select("*").eq("id", serviceId).limit(1));
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Service not found" });
      return null;
    }
    const service = toCamelCase<{ businessId: number }>(rows[0]);
    const access = await loadAccess(req, res, service.businessId);
    if (!access) return null;
    return { service, access };
  };

  app.get("/api/services/:id/variants", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await loadServiceAccess(req, res, parseInt(req.params.id));
      if (!ctx) return;
      const rows = unwrap(await supabase.from("service_variants").select("*").eq("service_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createVariantSchema = z.object({
    name: z.string().trim().min(1).max(200),
    price: z.coerce.number().int().min(0),
    duration: z.coerce.number().int().min(1).max(1440).optional(),
  });

  app.post("/api/services/:id/variants", requireAuth, async (req: AuthRequest, res) => {
    try {
      const ctx = await loadServiceAccess(req, res, parseInt(req.params.id));
      if (!ctx) return;
      const parsed = createVariantSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = unwrap(
        await supabase.from("service_variants").insert({
          service_id: parseInt(req.params.id),
          name: parsed.data.name,
          price: parsed.data.price,
          duration: parsed.data.duration,
        }).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/variants/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("service_variants").select("*").eq("id", parseInt(req.params.id)).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const variant = toCamelCase<{ serviceId: number }>(rows[0]);
      const ctx = await loadServiceAccess(req, res, variant.serviceId);
      if (!ctx) return;
      unwrap(await supabase.from("service_variants").delete().eq("id", parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("categories").select("*").eq("id", parseInt(req.params.id)).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const cat = toCamelCase<{ businessId: number }>(rows[0]);
      const access = await loadAccess(req, res, cat.businessId);
      if (!access) return;
      // Detach services pointing at this category, then delete it
      unwrap(await supabase.from("services").update({ category_id: null }).eq("category_id", parseInt(req.params.id)));
      unwrap(await supabase.from("categories").delete().eq("id", parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Accounting / transactions (owner + members) ---

  app.get("/api/businesses/:id/transactions", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      let query = supabase.from("transactions").select("*").eq("business_id", parseInt(req.params.id));
      if (typeof req.query.from === "string") query = query.gte("date", req.query.from);
      if (typeof req.query.to === "string") query = query.lte("date", req.query.to);
      const rows = unwrap(await query.order("date", { ascending: false }));
      res.json(toCamelCaseArray(rows || []));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createTransactionSchema = z.object({
    type: z.enum(["credit", "debit"]),
    amount: z.coerce.number().int().min(0),
    category: z.string().trim().max(100).optional(),
    description: z.string().trim().max(500).optional(),
    date: z.coerce.date().optional(),
  });

  app.post("/api/businesses/:id/transactions", requireAuth, requireOwnedBusiness, async (req: AuthRequest, res) => {
    try {
      const parsed = createTransactionSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = unwrap(
        await supabase.from("transactions").insert(
          toSnakeCase({
            businessId: parseInt(req.params.id),
            type: parsed.data.type,
            amount: parsed.data.amount,
            category: parsed.data.category,
            description: parsed.data.description,
            date: parsed.data.date ?? new Date(),
            createdBy: req.user!.uid,
          })
        ).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("transactions").select("*").eq("id", parseInt(req.params.id)).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const txn = toCamelCase<{ businessId: number }>(rows[0]);
      const access = await loadAccess(req, res, txn.businessId);
      if (!access) return;
      unwrap(await supabase.from("transactions").delete().eq("id", parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // --- Staff / members (admin only) ---

  app.get("/api/businesses/:id/members", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("members").select("*").eq("business_id", parseInt(req.params.id)));
      res.json(toCamelCaseArray(rows || []));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const createMemberSchema = z.object({
    email: z.string().trim().email().max(200),
    password: z.string().min(6).max(100),
    name: z.string().trim().max(200).optional(),
    role: z.enum(["admin", "staff"]).optional(),
  });

  app.post("/api/businesses/:id/members", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const parsed = createMemberSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const email = parsed.data.email.toLowerCase();

      // Create the login account directly (no Google needed). If it already
      // exists, reuse it. email_confirm so the member can sign in immediately.
      let uid: string | null = null;
      const created = await supabase.auth.admin.createUser({ email, password: parsed.data.password, email_confirm: true });
      if (created.data?.user) {
        uid = created.data.user.id;
      } else {
        const list = await supabase.auth.admin.listUsers();
        const existing = list.data.users.find((u: any) => u.email === email);
        if (existing) uid = existing.id;
        else return res.status(400).json({ error: created.error?.message || "Impossible de créer le compte." });
      }
      if (uid) unwrap(await supabase.from("users").upsert({ uid, email }, { onConflict: "uid" }));

      const result = unwrap(
        await supabase.from("members").insert({
          business_id: parseInt(req.params.id),
          email,
          uid,
          name: parsed.data.name,
          role: parsed.data.role ?? "staff",
        }).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const updateMemberSchema = z.object({ role: z.enum(["admin", "staff"]) });

  app.put("/api/members/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("members").select("*").eq("id", parseInt(req.params.id)).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const member = toCamelCase<{ businessId: number }>(rows[0]);
      const access = await loadAccess(req, res, member.businessId);
      if (!access) return;
      if (access.role !== "admin") return res.status(403).json({ error: "Réservé aux administrateurs" });
      const parsed = updateMemberSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const result = unwrap(
        await supabase.from("members").update({ role: parsed.data.role }).eq("id", parseInt(req.params.id)).select().single()
      );
      res.json(toCamelCase(result));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/members/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = unwrap(await supabase.from("members").select("*").eq("id", parseInt(req.params.id)).limit(1));
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Not found" });
      const member = toCamelCase<{ businessId: number }>(rows[0]);
      const access = await loadAccess(req, res, member.businessId);
      if (!access) return;
      if (access.role !== "admin") return res.status(403).json({ error: "Réservé aux administrateurs" });
      unwrap(await supabase.from("members").delete().eq("id", parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return app;
}
