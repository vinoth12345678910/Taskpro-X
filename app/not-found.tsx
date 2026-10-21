import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-paper px-5 text-center">
      <div>
        <div className="mb-6 flex justify-center"><Logo size={40} /></div>
        <h1 className="text-heading font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-1 text-body text-ink-3">The link may be old, or the page may have moved.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-body font-medium text-accent-ink hover:bg-accent-hover">
          Back to home
        </Link>
      </div>
    </main>
  );
}
