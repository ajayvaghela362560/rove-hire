import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  OfferLetterDocument,
  NdaDocument,
  ResumeDocument,
  type OfferLetterInput,
  type NdaInput,
  type ResumeInput,
} from "./documents";

export async function renderResume(input: ResumeInput): Promise<Buffer> {
  return renderToBuffer(<ResumeDocument {...input} />);
}

export async function renderOfferLetter(input: OfferLetterInput): Promise<Buffer> {
  return renderToBuffer(<OfferLetterDocument {...input} />);
}

export async function renderNda(input: NdaInput): Promise<Buffer> {
  return renderToBuffer(<NdaDocument {...input} />);
}
