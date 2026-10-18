import ClientReview from "@/components/client-review";
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientReview token={token} />;
}
