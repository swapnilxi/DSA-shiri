"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InterviewRoom } from "@/components/interview/InterviewRoom";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);
  const topic = useSearchParams().get("topic") ?? "General";

  return (
    <InterviewRoom
      sessionId={sessionId}
      topic={topic}
      onEnd={() => router.push("/dashboard")}
    />
  );
}
