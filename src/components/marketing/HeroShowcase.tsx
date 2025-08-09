import React from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export default function HeroShowcase() {
  return (
    <div className="relative">
      {/* Soft gradient/blur background shapes */}
      <div className="absolute -top-6 -left-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-8 -right-6 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative rounded-xl border bg-card/60 backdrop-blur shadow-sm">
        <AspectRatio ratio={16 / 10}>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
          <img
            src="/placeholder.svg"
            loading="lazy"
            alt="HandwerkOS Handwerkersoftware – App Screenshot"
            className="absolute inset-0 h-full w-full rounded-xl object-contain p-6"
          />
        </AspectRatio>
      </div>
    </div>
  );
}
