#!/usr/bin/env node
// ponytail: subset material-symbols-outlined.woff2 via `rlig` ligatures.
// Input glyphs are base letters a-z _ ; output ligatures like arrow_forward are generated via rlig.
// FontTools `subset --text` + rlig keeps only needed ligatures; re-subset pruned GSUB keeps size ~120KB vs 3.8MB.
// Upgrade path: if icon set grows beyond ~500 icons, switch to per-page subsets or replace with svg icons.
import { execSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcFont = join(
	root,
	"node_modules/material-symbols/material-symbols-outlined.woff2",
);
const outDir = join(root, "public/fonts");
const outFont = join(outDir, "material-symbols-outlined.subset.woff2");
const outCss = join(outDir, "material-symbols.css");
const iconsFile = "/tmp/9router_icons.txt";

function collectIcons() {
	// Re-scan using same heuristic as manual python: every quoted string that is a known ligature
	// plus icon: literals + span text. We rely on node to read ligature list via python helper.
	// Simpler: reuse fixed list produced by manual audit (181 icons) + include always-keep margin.
	// Generated via: python scan of src + ligature whitelist. See git history for regen recipe.
	const fixed = `account_circle account_tree add antigravity api apps arrow_back arrow_downward arrow_forward arrow_upward assistant attach_file bar_chart block bolt brush cached cancel chat check check_circle checklist chevron_left chevron_right close cloud cloud_off cloud_sync cloud_upload code computer content_copy contrast cookie dark_mode dashboard data_array data_object data_usage delete details dns done download edit enable error event expand_less expand_more explore extension filter_alt_off folder_open function gavel gitlab graphic_eq grid_view group hd health_and_safety help history host hourglass_top html http hub image image_search info input key keyboard_arrow_down keyboard_arrow_up label lan language layers light light_mode link link_off list lock lock_open login logout markdown menu mic mimo monitor monitoring movie music_note neurology news opacity open_in_new output overview password pause_circle pending perm_media person pip play_arrow play_circle playlist_add pool power_off power_settings_new priority progress_activity psychology public radio_button_unchecked record_voice_over refresh restart_alt rocket_launch route router save savings scatter_plot schedule science script search search_off security select send settings share shield shield_lock shield_with_heart skeleton sleep smart_toy sort star start stop stop_circle storage style switch sync sync_alt tab table target terminal title today toggle_off toggle_on token transform translate travel_explore update upgrade upload verified verified_user visibility visibility_off volunteer_activism vpn_key vpn_lock warning web wifi wifi_tethering`;
	return fixed;
}

function run(cmd) {
	console.log(`[subset] ${cmd}`);
	try {
		execSync(cmd, { stdio: "inherit" });
	} catch (e) {
		console.error(`[subset] failed: ${e.message}`);
		process.exit(e.status || 1);
	}
}

const icons = collectIcons();
writeFileSync(iconsFile, icons.split(" ").join(" ") + " ", "utf8");
console.log(`[subset] ${icons.split(" ").length} icons`);

if (!existsSync(srcFont)) {
	console.error(`[subset] missing ${srcFont} — run npm install`);
	process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// Step 1: build full rlig subset (letters -> ligatures) then prune GSUB to wanted set via python
// Keep textual path: fontTools closure via --text pulls rlig outputs from base letters
const py = process.env.PYTHON || "python3";
const tFull = "/tmp/9r_full_rlig.ttf";
run(
	`${py} -m fontTools.subset "${srcFont}" --text-file="${iconsFile}" --output-file="${tFull}" --layout-features=rlig --glyph-names`,
);

const tPruned = "/tmp/9r_pruned_gsub.ttf";
run(`${py} << 'PY'
from fontTools.ttLib import TTFont
f=TTFont("${tFull}")
wanted=set(open("${iconsFile}").read().split())
for lookup in f['GSUB'].table.LookupList.Lookup:
    for st in lookup.SubTable:
        ext=getattr(st,'ExtSubTable',None) or st
        if hasattr(ext,'ligatures') and ext.ligatures:
            new={}
            for first, ligs in list(ext.ligatures.items()):
                keep=[l for l in ligs if l.LigGlyph in wanted]
                if keep:
                    new[first]=keep
            ext.ligatures=new
f.save("${tPruned}")
print(f"pruned to {len(wanted)} ligatures")
PY`);

const wantGlyphs =
	icons.split(" ").join(",") +
	",a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,underscore,space";
run(
	`${py} -m fontTools.subset "${tPruned}" --glyphs="${wantGlyphs}" --output-file="${outFont}" --flavor=woff2 --layout-features=rlig --glyph-names --ignore-missing-glyphs`,
);

try {
	const stat = execSync(`ls -lh "${outFont}"`, { encoding: "utf8" }).trim();
	console.log(`[subset] wrote ${outFont} — ${stat}`);
	const orig = execSync(`ls -lh "${srcFont}"`, { encoding: "utf8" }).trim();
	console.log(`[subset] original ${orig}`);
} catch {}

writeFileSync(
	outCss,
	`@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 100 700;
  font-display: swap;
  src: url('/fonts/material-symbols-outlined.subset.woff2') format('woff2');
}
`,
	"utf8",
);
console.log(`[subset] wrote ${outCss}`);

// Also emit a no-op fallback so next/font doesn't double-load: public/fonts is copied to standalone
