import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./components/auth/AuthContext";

const featureMono = localFont({
  src: [
    {
      path: './fonts/FeatureMono-Hairline.ttf',
      weight: '100',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Thin.ttf',
      weight: '200',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Bold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/FeatureMono-Black.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
})

export const metadata: Metadata = {
  title: "The Circumstances",
  description: "Portfolio of the Circumstances",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${featureMono.className} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
