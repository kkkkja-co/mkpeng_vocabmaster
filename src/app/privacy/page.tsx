"use client";

export const dynamic = "force-dynamic";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/animations";

export default function PrivacyPage() {
  return (
    <motion.main
      className="mx-auto max-w-3xl px-6 py-16"
      {...pageTransition}
    >
      <h1 className="font-[family-name:var(--font-serif)] text-4xl font-normal mb-8">
        Privacy Policy
      </h1>

      <div className="prose prose-stone max-w-none space-y-6 text-warm-text-muted leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Plain-Language Summary</h2>
          <p>
            VocabMaster is a classroom vocabulary learning tool. We collect minimal data — just what&apos;s
            needed for teachers to track student progress. We encrypt personal information, never sell
            data, and use only free-tier hosting services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">What Data We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Student accounts:</strong> Class name, class number, and English name (all encrypted with AES-256)</li>
            <li><strong>Learning data:</strong> Vocabulary study progress, scores, response times, and battle results</li>
            <li><strong>Teacher accounts:</strong> Email address and role information</li>
            <li><strong>Audio files:</strong> Pronunciation recordings uploaded by teachers (stored on Cloudflare R2)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">How Data Is Stored</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Authentication:</strong> Firebase Authentication manages user sessions</li>
            <li><strong>Database:</strong> Cloud Firestore stores all application data</li>
            <li><strong>Encryption:</strong> Sensitive fields (names, class info, definitions, Chinese meanings) are encrypted with AES-256-GCM before storage</li>
            <li><strong>Audio files:</strong> Stored on Cloudflare R2, served via public URL</li>
            <li><strong>Sessions:</strong> Browser session cookies are used for authentication state</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Teacher Access</h2>
          <p>
            Teachers can view student learning analytics including scores, progress, and vocabulary
            performance. This data is visible only to the teacher who manages the student&apos;s class.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Student & Children&apos;s Privacy</h2>
          <p>
            VocabMaster is designed for classroom use. We collect the minimum data necessary for
            vocabulary learning. Student names are encrypted and not accessible to third parties.
            We comply with applicable student privacy regulations.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Data Retention</h2>
          <p>
            Student data is retained as long as the student is enrolled in a class. Teachers may
            remove student data upon request. Account deletion removes personal identifiers while
            preserving anonymized learning analytics.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Contact</h2>
          <p>
            For privacy-related questions, contact Kai Kwong Kan at{" "}
            <a href="https://www.bunorden.com" className="text-warm-accent underline" target="_blank" rel="noopener noreferrer">
              www.bunorden.com
            </a>
          </p>
        </section>

        <section>
          <p className="text-sm text-warm-text-subtle italic">
            This privacy policy may be updated periodically. Last updated: {new Date().toLocaleDateString()}.
            Please review with a legal professional before production deployment.
          </p>
        </section>
      </div>
    </motion.main>
  );
}
