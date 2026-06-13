import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail, verifyPassword } from "@/lib/users";
import {
  isBlocked,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/loginAttempts";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        const email = credentials.email;
        const blockStatus = isBlocked(email);

        if (blockStatus.blocked) {
          const minutes = Math.ceil((blockStatus.remainingMs ?? 0) / 60000);
          throw new Error(
            `Cuenta bloqueada. Intenta de nuevo en ${minutes} minuto(s).`
          );
        }

        const user = await getUserByEmail(email);

        if (!user) {
          const result = recordFailedAttempt(email);

          if (result.blocked) {
            throw new Error(
              "Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos."
            );
          }

          throw new Error(
            `Credenciales inválidas. ${result.attemptsLeft} intento(s) restante(s).`
          );
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.password
        );

        if (!isValid) {
          const result = recordFailedAttempt(email);

          if (result.blocked) {
            throw new Error(
              "Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos."
            );
          }

          throw new Error(
            `Credenciales inválidas. ${result.attemptsLeft} intento(s) restante(s).`
          );
        }

        resetAttempts(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/signIn",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
};
