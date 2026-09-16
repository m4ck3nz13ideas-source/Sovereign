"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui";

import { signOut } from "./actions";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      tone="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.push("/login");
        })
      }
    >
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}
