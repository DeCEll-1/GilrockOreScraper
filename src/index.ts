import { setTimeout } from 'node:timers/promises';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';

class Ore {
    // Properties (can be public by default)
    name: string;
    tier: string;
    rarity: number; // 1/rarity
    value: number; // $
    depthStart: number; // depthStart-depthEnd
    depthEnd: number; // depthStart-depthEnd
    health: number;
    usedIn: string[];
    description: string;

    constructor(
        name: string,
        tier: string,
        rarity: string,
        value: string,
        depth: string,
        health: string,
        usedIn: HTMLElement,
        description: string,
    ) {
        this.name = name;
        this.tier = tier;
        this.rarity = Number(rarity.substring(2));
        this.value = Number(value.replace("$", ""));

        const dpt: string[] = depth.replaceAll("m", "").split("-");
        this.depthStart = Number(dpt[0]);
        this.depthEnd = Number(dpt[1]);

        this.health = Number(health);

        if (usedIn) {
            const regexData = usedIn.innerHTML.replaceAll("<br>", "\n");
            this.usedIn = regexData.matchAll(/^.*[^a]>(.*)$/gm).map(k => {
                // https://regex101.com/r/GHfk65/1
                if (k == null || k[1] == null) return;
                return k[1]!.replaceAll("</a>", "");
            }).filter(s => s != null)!.toArray();
        }else
            this.usedIn = [];

        this.description = description;
    }

    public static async fromURL(url: string): Promise<Ore> {

        const dom = await getDomFromURL(url);


        const dataRows = dom.querySelectorAll(".custom-infobox-label").entries().map((e) => {
            const dataName = e[1].innerHTML;
            const dataValue = e[1].parentElement!.lastElementChild! as HTMLElement;
            // if (dataValue.childElementCount > 1)
            //     return { dataName, dataValue: dataValue.lastChild as HTMLElement };
            // else
            return { dataName, dataValue };
        }).toArray();

        let name: string;
        let tier: string;
        let rarity: string;
        let value: string;
        let depth: string;
        let health: string;
        let usedIn: HTMLElement;
        let description: string;

        const title = dom.querySelector(
            `
            .custom-infobox.infobox-tier-layer, 
            .custom-infobox-header
            `);
        const titleContentElement = title?.firstChild;
        name = titleContentElement!.textContent as string;
        tier = dataRows.find(s => s.dataName == "Tier")?.dataValue!.textContent!;
        rarity = dataRows.find(s => s.dataName == "Rarity")?.dataValue!.textContent!;
        value = dataRows.find(s => s.dataName == "Value")?.dataValue!.textContent!;
        depth = dataRows.find(s => s.dataName == "Depth")?.dataValue!.textContent!;
        health = dataRows.find(s => s.dataName == "Health")?.dataValue!.textContent!;
        usedIn = dataRows.find(s => s.dataName == "Used In")?.dataValue!;
        health = dataRows.find(s => s.dataName == "Health")?.dataValue!.textContent!;
        description = (dom.querySelector(".custom-infobox-description") as HTMLElement)?.textContent ?? "No Description... Yet.";

        return new Ore(name, tier, rarity, value, depth, health, usedIn, description);
    }
}

const API_URL = 'https://gilrock.fandom.com/api.php';

function getParamsForPage(page: string): URLSearchParams {
    return new URLSearchParams({
        action: 'parse',
        page: decodeURIComponent(page),
        prop: 'text',
        format: 'json',
    });
}

async function getDomFromURL(url: string): Promise<Document> {


    const params = getParamsForPage(url);

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${await response.text()}`);
    }

    const data: any = await response.json();
    const html: string = data.parse?.text?.['*']; // the rendered content

    if (!html) {
        throw new Error('No parsed text found');
    }

    const dom = new JSDOM(html, {
        contentType: "text/html",
        runScripts: "dangerously"
    });

    return dom.window.document;
}

async function getOreLinks(): Promise<string[]> {

    const document = await getDomFromURL("ores");

    const links: string[] = [];
    const anchors = document.querySelectorAll('.navbox-section .navbox-data a[href^="/wiki/"]');
    anchors.forEach(a => {
        if (a.parentElement?.parentElement?.classList.contains("navbox-header")) return;
        const href = a.getAttribute('href');
        if (href == null) return;
        const title = a.getAttribute('title') || '';
        console.log(href);
        links.push(href.replace("/wiki/", ""));

    });

    const unique = [...new Set(links)];
    console.log(`Found ${unique.length} unique ore URLs:`);
    unique.forEach((url, i) => console.log(`${i + 1}. ${url}`));

    return unique;
}
const oreURLs = await getOreLinks();
await setTimeout(1000);

fs.writeFile("ores.txt", oreURLs.join(",\n"), () => { });

fs.writeFile("ores.json", "[", () => { });
fs.writeFile("ores.min.json", "[", () => { });


for (let i = 0; i < oreURLs.length; i++) {
    const s = oreURLs[i]!;

    process.stdout.write(s);

    const ore = await Ore.fromURL(s);

    const json_pretty = JSON.stringify(ore, null, 4) + ",";
    const json = JSON.stringify(ore) + ",";

    fs.appendFile("ores.json",json_pretty, () => { });
    fs.appendFile("ores.min.json", json, () => { });

    console.log(" : downloaded");
    await setTimeout(1000);
}

fs.appendFile("ores.json", "]", () => { });
fs.appendFile("ores.min.json", "]", () => { });
