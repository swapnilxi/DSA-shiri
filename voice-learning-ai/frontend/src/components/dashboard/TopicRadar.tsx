"use client";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { TopicMastery } from "@/lib/api";

interface Props {
  data: TopicMastery[];
}

export function TopicRadar({ data }: Props) {
  const chartData = data.slice(0, 8).map((d) => ({
    topic: d.topic.length > 12 ? d.topic.slice(0, 12) + "…" : d.topic,
    score: Math.round(d.avg_score),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#374151" />
        <PolarAngleAxis dataKey="topic" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
        <Radar name="Score" dataKey="score" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          formatter={(v: number) => [`${v}/100`, "Avg Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
