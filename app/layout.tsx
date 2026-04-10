/**
 * RootLayout configures global fonts, HTML shell, and wraps all pages in the AuthProvider.
 * Required by Next.js App Router; used implicitly by every route in the app.
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "./components/auth/AuthContext";
import RouteShapeTransitionManager from "./components/RouteShapeTransitionManager";
import { SongProvider } from "./components/songs/SongProvider";
import { LoadingProvider } from "./context/LoadingContext";
import { LoadingScreen } from "./components/loading/LoadingScreen";
import { DeviceTierProvider } from "./context/DeviceTierContext";

const featureMono = localFont({
  src: [
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
          <DeviceTierProvider>
            <LoadingProvider>
              <SongProvider>
                <RouteShapeTransitionManager />
                <LoadingScreen />
                {children}
              </SongProvider>
            </LoadingProvider>
          </DeviceTierProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
