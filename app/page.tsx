import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex max-w-2xl flex-col items-center gap-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bridge your tech stack transition
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Tell us where you are and where you want to go. Dev Stack Bridge Tool
          generates an AI-powered, step-by-step plan to move from your current
          stack to your target role.
        </p>
        <Button asChild size="lg">
          <Link href="/transitions/new">Get started</Link>
        </Button>
      </div>
    </main>
  );
}
