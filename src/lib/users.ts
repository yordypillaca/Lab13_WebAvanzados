import bcrypt from "bcryptjs";
import fs from "fs/promises";
import os from "os";
import path from "path";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

function getUsersFilePath(): string {
  // Vercel serverless: solo /tmp es escribible (no /var/task/data)
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "users.json");
  }

  return path.join(process.cwd(), "data", "users.json");
}

async function ensureUsersFile() {
  const usersFile = getUsersFilePath();

  try {
    await fs.access(usersFile);
  } catch {
    if (!process.env.VERCEL) {
      await fs.mkdir(path.dirname(usersFile), { recursive: true });
    }
    await fs.writeFile(usersFile, "[]");
  }
}

export async function getUsers(): Promise<User[]> {
  await ensureUsersFile();
  const data = await fs.readFile(getUsersFilePath(), "utf-8");
  return JSON.parse(data) as User[];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<Omit<User, "password">> {
  const users = await getUsers();

  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("El correo ya está registrado");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user: User = {
    id: crypto.randomUUID(),
    name,
    email,
    password: hashedPassword,
  };

  users.push(user);
  await fs.writeFile(getUsersFilePath(), JSON.stringify(users, null, 2));

  return { id: user.id, name: user.name, email: user.email };
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
