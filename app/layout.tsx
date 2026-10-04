import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

export const viewport: Viewport = {width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#efe8d8"},{media:"(prefers-color-scheme: dark)",color:"#0d1310"}]};

export const metadata: Metadata = {
  title: "Personal Evidence",
  description: "Connect wearable observations with the context of your day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
