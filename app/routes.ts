import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/auth", "routes/auth.tsx"),
  route("/upload", "routes/upload.tsx"),
  route("/resume/:id", "routes/resume.tsx"),
  route("/resume/:id/edit", "routes/resume.$id.edit.tsx"),
  route("/resume/:id/optimize", "routes/resume.$id.optimize.tsx"),
  route("/resume/:id/result", "routes/resume.$id.result.tsx"),
  route("/wipe", "routes/wipe.tsx"),
  route("/api", "routes/api_.ts"),
  route("/api/scrape", "routes/api_.scrape.ts"),
] satisfies RouteConfig;
