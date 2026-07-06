import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Built-in standard PDF fonts (Helvetica / Times) — no font files to bundle and
// nothing to fetch at render time, so generation cannot flake on a cold start.
const BRAND = "#4F46E5";
const INK = "#0F172A";
const MUTED = "#475569";
const HAIRLINE = "#E2E8F0";

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: INK,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  wordmark: { fontFamily: "Times-Bold", fontSize: 22, letterSpacing: 2, color: INK },
  tagline: { fontSize: 8, letterSpacing: 1.5, color: MUTED, marginTop: 2 },
  companyMeta: { fontSize: 8, color: MUTED, textAlign: "right", lineHeight: 1.4 },
  rule: { height: 2, backgroundColor: BRAND, marginTop: 10, marginBottom: 22 },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 15, marginBottom: 4 },
  docSubtitle: { fontSize: 9, color: MUTED, marginBottom: 20 },
  meta: { fontSize: 9, color: MUTED, marginBottom: 18 },
  greeting: { marginBottom: 10 },
  para: { marginBottom: 12, textAlign: "justify" },
  termsBox: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 4,
    padding: 14,
    marginBottom: 16,
  },
  termRow: { flexDirection: "row", marginBottom: 6 },
  termLabel: { width: 150, color: MUTED, fontSize: 9.5 },
  termValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  clauseTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginTop: 8, marginBottom: 3 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 42 },
  sigBlock: { width: "42%" },
  sigLine: { borderTopWidth: 1, borderTopColor: INK, marginBottom: 4 },
  sigName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  sigMeta: { fontSize: 8.5, color: MUTED },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 64,
    right: 64,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 8,
    fontSize: 7.5,
    color: MUTED,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Letterhead() {
  return (
    <View>
      <View style={s.headerRow}>
        <View>
          <Text style={s.wordmark}>ROVE</Text>
          <Text style={s.tagline}>DASHCAM SYSTEMS</Text>
        </View>
        <Text style={s.companyMeta}>
          ROVE Technologies, Inc.{"\n"}1 Market Street, Suite 400{"\n"}San Francisco, CA 94105{"\n"}
          people@rovedashcam.com
        </Text>
      </View>
      <View style={s.rule} />
    </View>
  );
}

function Footer({ label }: { label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>ROVE Technologies, Inc. — Confidential</Text>
      <Text>{label}</Text>
    </View>
  );
}

function SignatureBlock({
  leftName,
  leftMeta,
  rightName,
  rightMeta,
}: {
  leftName: string;
  leftMeta: string;
  rightName: string;
  rightMeta: string;
}) {
  return (
    <View style={s.sigRow}>
      <View style={s.sigBlock}>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{leftName}</Text>
        <Text style={s.sigMeta}>{leftMeta}</Text>
      </View>
      <View style={s.sigBlock}>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{rightName}</Text>
        <Text style={s.sigMeta}>{rightMeta}</Text>
      </View>
    </View>
  );
}

export interface OfferLetterInput {
  candidateName: string;
  roleTitle: string;
  salaryLabel: string; // e.g. "$120,000.00 USD per year"
  startDate: string; // long-form
  reportingManager: string;
  location: string;
  generatedDate: string; // long-form
  reference: string; // document reference id
}

export function OfferLetterDocument(props: OfferLetterInput) {
  const firstName = props.candidateName.split(" ")[0] ?? props.candidateName;
  return (
    <Document
      title={`Offer Letter — ${props.candidateName}`}
      author="ROVE Technologies, Inc."
    >
      <Page size="A4" style={s.page}>
        <Letterhead />
        <Text style={s.docTitle}>Letter of Employment Offer</Text>
        <Text style={s.docSubtitle}>Private &amp; Confidential</Text>
        <Text style={s.meta}>{props.generatedDate}</Text>

        <Text style={s.greeting}>Dear {firstName},</Text>
        <Text style={s.para}>
          On behalf of everyone at ROVE Technologies, Inc. ("ROVE"), it is my pleasure to extend
          this offer of employment for the position of <Text style={{ fontFamily: "Helvetica-Bold" }}>{props.roleTitle}</Text>.
          We were genuinely impressed throughout our conversations, and we believe your experience
          will make a meaningful contribution to the team building the next generation of connected
          dashcam systems.
        </Text>

        <View style={s.termsBox}>
          <View style={s.termRow}>
            <Text style={s.termLabel}>Position</Text>
            <Text style={s.termValue}>{props.roleTitle}</Text>
          </View>
          <View style={s.termRow}>
            <Text style={s.termLabel}>Annual Compensation</Text>
            <Text style={s.termValue}>{props.salaryLabel}</Text>
          </View>
          <View style={s.termRow}>
            <Text style={s.termLabel}>Start Date</Text>
            <Text style={s.termValue}>{props.startDate}</Text>
          </View>
          <View style={s.termRow}>
            <Text style={s.termLabel}>Reporting Manager</Text>
            <Text style={s.termValue}>{props.reportingManager}</Text>
          </View>
          <View style={[s.termRow, { marginBottom: 0 }]}>
            <Text style={s.termLabel}>Work Location</Text>
            <Text style={s.termValue}>{props.location}</Text>
          </View>
        </View>

        <Text style={s.para}>
          This offer is contingent upon the successful completion of our standard background and
          reference checks and your execution of ROVE&apos;s Confidentiality &amp; Non-Disclosure
          Agreement. Your employment with ROVE is at-will, meaning that either you or the company may
          terminate the relationship at any time, with or without cause or notice.
        </Text>
        <Text style={s.para}>
          We are excited about the prospect of you joining us. To accept, please sign and date below
          and return a copy to our People team. This offer remains open for seven (7) calendar days
          from the date above.
        </Text>

        <SignatureBlock
          leftName="Jordan Avery"
          leftMeta="Head of People, ROVE Technologies, Inc."
          rightName={props.candidateName}
          rightMeta="Candidate — Signature &amp; Date"
        />

        <Footer label={`Offer Ref: ${props.reference}`} />
      </Page>
    </Document>
  );
}

export interface ResumeExperience {
  role: string;
  company: string;
  period: string;
  points: string[];
}

export interface ResumeInput {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experiences: ResumeExperience[];
}

const r = StyleSheet.create({
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, color: INK },
  role: { fontSize: 11, color: BRAND, marginTop: 2, fontFamily: "Helvetica-Bold" },
  contact: { fontSize: 9, color: MUTED, marginTop: 4 },
  section: { fontFamily: "Helvetica-Bold", fontSize: 11, color: INK, marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  skill: { fontSize: 8.5, backgroundColor: "#EEF2FF", color: BRAND, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3 },
  expHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  expRole: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  expPeriod: { fontSize: 8.5, color: MUTED },
  bullet: { flexDirection: "row", marginTop: 3, paddingLeft: 4 },
  bulletDot: { width: 10, fontSize: 9 },
  bulletText: { flex: 1, fontSize: 9.5, color: "#334155" },
});

export function ResumeDocument(props: ResumeInput) {
  return (
    <Document title={`Resume — ${props.name}`} author={props.name}>
      <Page size="A4" style={s.page}>
        <Text style={r.name}>{props.name}</Text>
        <Text style={r.role}>{props.title}</Text>
        <Text style={r.contact}>
          {props.email}  ·  {props.phone}  ·  {props.location}
        </Text>
        <View style={s.rule} />

        <Text style={r.section}>Summary</Text>
        <Text style={{ fontSize: 9.5, color: "#334155", lineHeight: 1.5 }}>{props.summary}</Text>

        <Text style={r.section}>Skills</Text>
        <View style={r.skillsRow}>
          {props.skills.map((sk) => (
            <Text key={sk} style={r.skill}>
              {sk}
            </Text>
          ))}
        </View>

        <Text style={r.section}>Experience</Text>
        {props.experiences.map((exp, i) => (
          <View key={i}>
            <View style={r.expHeader}>
              <Text style={r.expRole}>
                {exp.role} · {exp.company}
              </Text>
              <Text style={r.expPeriod}>{exp.period}</Text>
            </View>
            {exp.points.map((pt, j) => (
              <View key={j} style={r.bullet}>
                <Text style={r.bulletDot}>•</Text>
                <Text style={r.bulletText}>{pt}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export interface NdaInput {
  candidateName: string;
  date: string; // long-form (today)
  reference: string;
}

export function NdaDocument(props: NdaInput) {
  return (
    <Document
      title={`NDA — ${props.candidateName}`}
      author="ROVE Technologies, Inc."
    >
      <Page size="A4" style={s.page}>
        <Letterhead />
        <Text style={s.docTitle}>Confidentiality &amp; Non-Disclosure Agreement</Text>
        <Text style={s.docSubtitle}>Private &amp; Confidential</Text>
        <Text style={s.meta}>
          This Agreement is entered into as of {props.date}, by and between ROVE Technologies, Inc.
          ("ROVE") and <Text style={{ fontFamily: "Helvetica-Bold" }}>{props.candidateName}</Text> ("Recipient").
        </Text>

        <Text style={s.clauseTitle}>1. Confidential Information</Text>
        <Text style={s.para}>
          "Confidential Information" means any non-public information disclosed by ROVE to the
          Recipient, whether oral, written, or electronic, including but not limited to product
          designs, firmware, source code, hardware specifications, business plans, customer data,
          and financial information.
        </Text>

        <Text style={s.clauseTitle}>2. Obligations of the Recipient</Text>
        <Text style={s.para}>
          The Recipient agrees to hold all Confidential Information in strict confidence, to use it
          solely for the purpose of evaluating or performing the prospective engagement with ROVE,
          and not to disclose it to any third party without ROVE&apos;s prior written consent.
        </Text>

        <Text style={s.clauseTitle}>3. Term</Text>
        <Text style={s.para}>
          The obligations set forth herein shall survive for a period of three (3) years from the
          date of disclosure, and shall survive indefinitely with respect to any trade secrets.
        </Text>

        <Text style={s.clauseTitle}>4. Return of Materials</Text>
        <Text style={s.para}>
          Upon ROVE&apos;s written request, the Recipient shall promptly return or destroy all
          materials containing Confidential Information and certify such destruction in writing.
        </Text>

        <Text style={s.clauseTitle}>5. No License; Governing Law</Text>
        <Text style={s.para}>
          Nothing in this Agreement grants the Recipient any license or right to any intellectual
          property of ROVE. This Agreement shall be governed by the laws of the State of California,
          without regard to its conflict-of-laws principles.
        </Text>

        <SignatureBlock
          leftName="Jordan Avery"
          leftMeta="Head of People, ROVE Technologies, Inc."
          rightName={props.candidateName}
          rightMeta="Recipient — Signature &amp; Date"
        />

        <Footer label={`NDA Ref: ${props.reference}`} />
      </Page>
    </Document>
  );
}
