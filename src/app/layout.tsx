import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FUTH LAFIA HR — HUMAN RESOURCES MANAGEMENT SYSTEM",
  description:
    "FEDERAL UNIVERSITY TEACHING HOSPITAL — HUMAN RESOURCES MANAGEMENT SYSTEM.",
  keywords: [
    "FUTH LAFIA",
    "HR",
    "Human Resources Management",
    "Requisitions",
    "Registry Files",
  ],
  authors: [{ name: "FUTH LAFIA" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <SonnerToaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
