/** @type {import("next").NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // 关键：不要做静态导出/静态预渲染导致的 CSR bailout 检查失败
    output: "standalone",
};

module.exports = nextConfig;
