import type { NextConfig } from "next";

//const nextConfig: NextConfig = {
//  output: "standalone",
  /* config options here */
 // typescript: {
  //  ignoreBuildErrors: true,
 //},
 // reactStrictMode: false,
//};

//export default nextConfig;

const nextConfig = {
  output: 'standalone', 
  images: {
    unoptimized: true, // Recommended: Shared hosting often lacks libraries like Sharp, causing CPU spikes
  },
  typescript: {
    ignoreBuildErrors: true,
	},
};


export default nextConfig;
