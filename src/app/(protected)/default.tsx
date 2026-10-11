import { notFound } from "next/navigation";

// The implicit children slot also needs an explicit unmatched-route contract.
export default function Default() {
  notFound();
}
