import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileBox,
  FileCode2,
  Files,
  MessageSquareText,
} from "lucide-react";
import { ArtistReuse } from "@/components/artist-reuse";
import { ProjectState } from "@/components/project-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes, useProject } from "@/lib/project-query";

const descriptions: Record<string, string> = {
  GLB: "The complete 3D scene. Open in the studio or your preferred model viewer.",
  STL: "Triangle mesh for CAD and fabrication workflows. Original units: inches.",
  OBJ: "Editable geometry with seven named component groups. Original units: inches.",
  HTML: "The original interactive viewer, preserved as downloaded. Uses a Three.js CDN.",
};

export default function Archive() {
  const project = useProject();
  if (!project.data)
    return (
      <ProjectState
        error={project.isError}
        retry={() => void project.refetch()}
      />
    );
  return (
    <div className="page-content">
      <div className="compact-heading">
        <span className="eyebrow">SCULPTURE STUDY / 003</span>
        <h1>
          Keep the <em>originals.</em>
        </h1>
        <p>The source files, preserved exactly as they arrived.</p>
      </div>
      <div className="archive-summary">
        <Files size={20} />
        <strong>{project.data.assets.length} original files</strong>
        <span className="muted">
          Copied from the supplied downloads · SHA-256 recorded
        </span>
        <Badge variant="secondary">
          <Check size={12} />
          Preserved
        </Badge>
      </div>
      <div className="asset-grid">
        {project.data.assets.map((asset) => (
          <Card className="asset-card" key={asset.name}>
            <CardContent>
              <div className="asset-top">
                <div className="asset-icon">
                  {asset.format.toUpperCase() === "HTML" ? (
                    <FileCode2 size={26} strokeWidth={1.3} />
                  ) : (
                    <FileBox size={26} strokeWidth={1.3} />
                  )}
                </div>
                <Badge variant="outline">{asset.format.toUpperCase()}</Badge>
              </div>
              <h2>{asset.name}</h2>
              <p>
                {descriptions[asset.format.toUpperCase()] ??
                  "Original project file."}
              </p>
              <div className="asset-meta">
                <span>{formatBytes(asset.bytes)}</span>
                <span>Original file</span>
              </div>
              <details className="checksum">
                <summary>SHA-256 checksum</summary>
                <code>{asset.sha256}</code>
              </details>
              <Button variant="outline" className="asset-download" asChild>
                <a href={asset.url} download>
                  <ArrowDownToLine size={15} />
                  Download {asset.format.toUpperCase()}
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <ArtistReuse />
      <section className="source-note">
        <span className="source-icon">
          <MessageSquareText size={23} strokeWidth={1.4} />
        </span>
        <div>
          <div className="source-note-heading">
            <h2>The conversation behind the sculpture</h2>
            <Badge variant="outline">Transcript pending</Badge>
          </div>
          <p>
            The four supplied artifacts are archived. The Claude conversation is
            still unavailable through the public download endpoint, so its
            messages and any additional project files are not included here.
          </p>
          <a
            href={project.data.source.url}
            className="text-link"
            target="_blank"
            rel="noreferrer"
          >
            Open the original Claude share <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
      <p className="section-note">
        Original model coordinates use inches, with the Y axis pointing up.
      </p>
    </div>
  );
}
