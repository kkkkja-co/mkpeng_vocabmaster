"use client";

export const dynamic = "force-dynamic";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/animations";

export default function TermsPage() {
  return (
    <motion.main
      className="mx-auto max-w-3xl px-6 py-16"
      {...pageTransition}
    >
      <h1 className="font-[family-name:var(--font-serif)] text-4xl font-normal mb-8">
        Terms of Use
      </h1>

      <div className="prose prose-stone max-w-none space-y-6 text-warm-text-muted leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Acceptance of Terms</h2>
          <p>
            By accessing or using VocabMaster, you agree to be bound by these Terms of Use.
            If you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Educational Use Only</h2>
          <p>
            VocabMaster is designed exclusively for classroom vocabulary learning.
            Commercial use, redistribution, or use outside of educational contexts is prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Account Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Students log in anonymously — no email or password required</li>
            <li>Teachers are responsible for maintaining the confidentiality of their login credentials</li>
            <li>Users must not attempt to access accounts belonging to others</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Student & Teacher Roles</h2>
          <p>
            Teachers manage classes, modules, and vocabulary cards. Students study vocabulary,
            practice spelling, play games, and participate in battles. Each role has specific
            permissions and access levels.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Acceptable Use</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Do not submit inappropriate, offensive, or inaccurate content</li>
            <li>Do not attempt to exploit bugs or vulnerabilities</li>
            <li>Do not use automated tools to access the platform</li>
            <li>Treat other participants with respect during battle mode</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Battle Feature Conduct</h2>
          <p>
            Battle mode is a competitive learning feature. Fair play is expected. Any form of
            cheating, harassment, or disruptive behavior during battles may result in access restrictions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Service Availability</h2>
          <p>
            VocabMaster is provided &quot;as is&quot; on a free-tier infrastructure. We strive for
            high availability but cannot guarantee uninterrupted service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Disclaimer</h2>
          <p>
            VocabMaster is an educational tool. We are not responsible for academic outcomes.
            The platform supplements but does not replace professional language instruction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-warm-text mb-3">Contact</h2>
          <p>
            For questions about these terms, contact Kai Kwong Kan at{" "}
            <a href="https://www.bunorden.com" className="text-warm-accent underline" target="_blank" rel="noopener noreferrer">
              www.bunorden.com
            </a>
          </p>
        </section>

        <section>
          <p className="text-sm text-warm-text-subtle italic">
            These terms may be updated periodically. Last updated: {new Date().toLocaleDateString()}.
            Please review with a legal professional before production deployment.
          </p>
        </section>
      </div>
    </motion.main>
  );
}
