import type { FileInfo } from "hydrooj";
import { type Context, DomainModel, ProblemModel, Schema } from "hydrooj";
import { detect } from "tinyld/*";

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
                        "reference",
                    ])
                        .sort({ pid: 1 })
                        .skip(page * pageSize)
                        .limit(pageSize)
                        .toArray();

                    for (const pdoc of pdocs) {
                        try {
                            let additionalFiles: FileInfo[];
                            if (pdoc.reference) {
                                const original = await ProblemModel.get(pdoc.reference.domainId, pdoc.reference.pid, [
                                    "additional_file",
                                ]);
                                additionalFiles = original?.additional_file ?? [];
                            } else {
                                additionalFiles = pdoc.additional_file ?? [];
                            }
                            if (additionalFiles.length > 0) {
                                const fileLinks = additionalFiles.map((f) => ({
                                    name: f.name,
                                    url: "file://" + f.name,
                                }));

                                const content = getContentWithFileLinks(pdoc.content, fileLinks);

                                // If content is null, it means no update is needed.
                                if (!content) continue;

                                await ProblemModel.edit(domainId, pdoc.docId, { content });
                                report({
                                    message: `Updated problem ${pdoc.pid} in domain ${domainId} with additional file links.`,
                                });
                            }
                        } catch (error) {
                            report({ message: `Error processing problem ${pdoc.pid} in domain ${domainId}` });
                            report({ message: `${(error as Error).message}\n${(error as Error).stack}` });
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

function getContentWithFileLinks(content: string, fileLinks: { name: string; url: string }[]): string | null {
    let parsedContent: Record<string, string> | null;
    try {
        // Try parsing content as JSON to determine if it's structured data.
        parsedContent = JSON.parse(content) as Record<string, string>;
        if (typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
            parsedContent = null; // Not a JSON object, treat as plain text.
        }
    } catch {
        parsedContent = null;
    }

    if (parsedContent) {
        // If content is a JSON object, add file links under a new "additional_files" key.
        const newContentObj: Record<string, string> = {};
        let isModified = false;
        for (const [lang, text] of Object.entries(parsedContent)) {
            if (fileLinks.every((link) => text.includes(link.url))) {
                newContentObj[lang] = text;
                continue;
            }

            const title = getTitle(lang);
            const linksMarkdown = fileLinks.map((link) => `- [${link.name}](${link.url})`).join("\n");
            newContentObj[lang] = `${text}\n\n## ${title}\n${linksMarkdown}\n`;
            isModified = true;
        }
        return isModified ? JSON.stringify(newContentObj) : null;
    } else {
        if (fileLinks.every((link) => content.includes(link.url))) {
            return null;
        }

        let lang: string;
        try {
            lang = detect(content) || "zh";
        } catch {
            lang = "zh";
        }

        const title = getTitle(lang);
        const linksMarkdown = fileLinks.map((link) => `- [${link.name}](${link.url})`).join("\n");
        content += `\n\n## ${title}\n${linksMarkdown}\n`;
        content += +"\n";

        return content;
    }
}

function getTitle(lang: string) {
    switch (lang) {
        case "ja":
        case "jp":
            return "追加ファイル";
        case "ko":
            return "추가 파일";
        case "en":
            return "Additional Files";
        case "zh_TW":
            return "附加檔案";
        case "zh":
        case "cn":
        default:
            return "附加文件";
    }
}
