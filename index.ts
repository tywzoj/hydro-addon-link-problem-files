import type { FileInfo } from "hydrooj";
import { type Context, DomainModel, ProblemModel, Schema } from "hydrooj";
import { detect } from "tinyld";

export function apply(ctx: Context) {
    ctx.addScript<{ domainIds: string[] }>(
        "linkProblemFileToContent",
        "Insert links to problem files into problem content for contests and homeworks.",
        Schema.object({
            domainIds: Schema.array(Schema.string()).default(["system"]),
        }),
        async (args, report: (data: any) => void) => {
            const domainIds =
                args.domainIds.length > 0
                    ? args.domainIds
                    : await DomainModel.getMulti()
                          .map((ddoc) => ddoc._id)
                          .toArray();

            for (const domainId of domainIds) {
                const pCount = await ProblemModel.count(domainId, {});
                const pageSize = 100;
                const pageCount = Math.ceil(pCount / pageSize);
                for (let page = 0; page < pageCount; page++) {
                    const pdocs = await ProblemModel.getMulti(domainId, {}, [
                        "pid",
                        "docId",
                        "additional_file",
                        "content",
                    ])
                        .sort({ pid: 1 })
                        .skip(page * pageSize)
                        .limit(pageSize)
                        .toArray();

                    for (const pdoc of pdocs) {
                        try {
                            let additionalFiles: FileInfo[];
                            if (pdoc.reference) {
                                const original = await ProblemModel.get(pdoc.domainId, pdoc.reference.pid);
                                additionalFiles = original?.additional_file ?? [];
                            } else {
                                additionalFiles = pdoc.additional_file ?? [];
                            }
                            if (additionalFiles.length > 0) {
                                const fileLinks = additionalFiles.map((f) => ({
                                    name: f.name,
                                    url: "file://" + f.name,
                                }));

                                if (fileLinks.every((link) => pdoc.content.includes(link.url))) {
                                    continue; // All links already present, skip.
                                }

                                let content = pdoc.content;
                                content += `\n\n## ${getTitle(content)}\n`;
                                for (const link of fileLinks) {
                                    content += `- [${link.name}](${link.url})\n`;
                                }

                                await ProblemModel.edit(domainId, pdoc.docId, { content });
                                report({
                                    message: `Updated problem ${pdoc.pid} in domain ${domainId} with additional file links.`,
                                });
                            }
                        } catch (error) {
                            report({ message: `Error processing problem ${pdoc.pid} in domain ${domainId}` });
                            report({ message: (error as Error).message });
                        }
                    }
                }
                report({ message: `Completed processing domain ${domainId}.` });
            }

            report({ message: "Completed linking problem files to content." });

            return true;
        },
    );
}

function getTitle(content: string) {
    const lang = detect(content);
    switch (lang) {
        case "zh":
        case "cn":
            return "附加文件";
        case "ja":
        case "jp":
            return "追加ファイル";
        case "ko":
            return "추가 파일";
        case "en":
        default:
            return "Additional Files";
    }
}
