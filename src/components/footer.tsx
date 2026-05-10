import Link from "next/link";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-warm-border bg-warm-surface">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-warm-text-muted">
            Made with{" "}
            <Heart className="inline-block size-3.5 fill-warm-accent text-warm-accent" />{" "}
            by Kai Kwong Kan @ Bunorden ({" "}
            <Link
              href="https://www.bunorden.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-warm-accent/40 underline-offset-2 transition-colors hover:text-warm-accent"
            >
              www.bunorden.com
            </Link>
            )
          </p>
          <div className="flex gap-6 text-xs text-warm-text-subtle">
            <Link
              href="/privacy"
              className="transition-colors hover:text-warm-text-muted"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-warm-text-muted"
            >
              Terms of Use
            </Link>
          </div>
          <p className="text-xs text-warm-text-subtle">
            &copy; {new Date().getFullYear()} VocabMaster. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
