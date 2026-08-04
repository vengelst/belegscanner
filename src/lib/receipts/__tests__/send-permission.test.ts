import { describe, it, expect } from "vitest";
import { canUserSendReceipt } from "@/lib/receipts/send-permission";

describe("canUserSendReceipt", () => {
  it("erlaubt ADMIN immer, unabhaengig vom Review-Status und Flag", () => {
    expect(
      canUserSendReceipt({
        role: "ADMIN",
        canSendWithoutApproval: false,
        reviewStatus: "DRAFT",
      }),
    ).toBe(true);
    expect(
      canUserSendReceipt({
        role: "ADMIN",
        canSendWithoutApproval: false,
        reviewStatus: "IN_REVIEW",
      }),
    ).toBe(true);
    expect(
      canUserSendReceipt({
        role: "ADMIN",
        canSendWithoutApproval: true,
        reviewStatus: "DEFERRED",
      }),
    ).toBe(true);
  });

  it("erlaubt USER mit APPROVED auch ohne Flag", () => {
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: false,
        reviewStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  it("blockt USER ohne Flag und ohne APPROVED", () => {
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: false,
        reviewStatus: "DRAFT",
      }),
    ).toBe(false);
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: false,
        reviewStatus: "IN_REVIEW",
      }),
    ).toBe(false);
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: false,
        reviewStatus: "DEFERRED",
      }),
    ).toBe(false);
  });

  it("erlaubt USER mit Flag auch aus DRAFT/IN_REVIEW", () => {
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: true,
        reviewStatus: "DRAFT",
      }),
    ).toBe(true);
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: true,
        reviewStatus: "IN_REVIEW",
      }),
    ).toBe(true);
    expect(
      canUserSendReceipt({
        role: "USER",
        canSendWithoutApproval: true,
        reviewStatus: "DEFERRED",
      }),
    ).toBe(true);
  });
});
