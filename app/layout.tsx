import type { Metadata } from "next";
import "./globals.css";
import { ProgressProvider } from "@/lib/game/progress";
import { Shell } from "@/components/Shell";
import { APP_NAME, TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <ProgressProvider>
          <Shell>{children}</Shell>
        </ProgressProvider>
      </body>
    </html>
  );
}
