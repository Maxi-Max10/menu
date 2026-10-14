import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/api";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const normalized = email.toLowerCase().trim();
    if (normalized === process.env.ADMIN_EMAIL?.toLowerCase() && password === process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD) {
      await createSession({ role: "admin", email: normalized });
      return NextResponse.json({ role: "admin" });
    }
    const { rows } = await query<{ id: string; restaurant_id: string; email: string; password_hash: string }>("SELECT * FROM users WHERE email = $1", [normalized]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
    await createSession({ role: "restaurant", restaurantId: user.restaurant_id, email: user.email });
    return NextResponse.json({ role: "restaurant" });
  } catch (error) { return apiError(error); }
}
