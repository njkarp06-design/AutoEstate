"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer } from "@/lib/customer";
import { setInquiryHandled } from "@/lib/inquiries";

export async function setInquiryHandledAction(inquiryId: string, handled: boolean) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  await setInquiryHandled(inquiryId, customer, handled);
  revalidatePath(`/inquiries/${inquiryId}`);
  revalidatePath("/inquiries");
}
