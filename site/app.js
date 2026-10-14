(function () {
    var D = window.LUIGI_DATA;
    var roster = D.roster;
    var byName = {};
    roster.forEach(function (c) { byName[c.name] = c; });

    // Stage list (sprite = column in stages.webp). ceiling / platforms come from the
    // "Dthrow > Up B" lab sheet; both are % relative to the listed windows.
    var STAGES = [
        { name: "Battlefield", sprite: 13, shortcuts: "bf, bat, battlefield", platforms: { side: "-7", top: "-16" } },
        { name: "Final Destination", sprite: 1, shortcuts: "fd, fi", ceiling: -4, lowCeiling: true },
        { name: "Small Battlefield", sprite: 8, shortcuts: "small, sbf, smallbattlefield", platforms: { all: "-13" } },
        { name: "Pokémon Stadium 2", sprite: 7, shortcuts: "ps2, ps, stadium", ceiling: -4, lowCeiling: true, platforms: { all: "-12" } },
        { name: "Smashville", sprite: 9, shortcuts: "sv, smashville, smas", ceiling: -1, platforms: { all: "-10" } },
        { name: "Town & City", sprite: 10, shortcuts: "tnc, t&c, town, townandcity, towncity", ceiling: -1, platforms: { side: "-9/-10", top: "-15" } },
        { name: "Kalos Pokémon League", sprite: 4, shortcuts: "kalos", ceiling: 0, platforms: { all: "-10" } },
        { name: "Lylat Cruise", sprite: 5, shortcuts: "lylat" },
        { name: "Yoshi's Story", sprite: 11, shortcuts: "yoshi, yoshis, ys", ceiling: -4, lowCeiling: true, platforms: { side: "-14", top: "-23" } },
        { name: "Unova Pokémon League", sprite: 12, shortcuts: "unova" },
        { name: "Hollow Bastion", sprite: 3, shortcuts: "hb", ceiling: -4, lowCeiling: true, platforms: { all: "-13" } },
        { name: "Northern Cave", sprite: 2, shortcuts: "nc, nor", ceiling: -5, lowCeiling: true }
    ];

    var curChar = byName["Mario"];
    var curStage = STAGES[0];

    function store(k, v) {
        try {
            if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
        } catch (e) { return null; }
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    // ------------------------------------------------------------ fuzzy search
    function norm(s) {
        return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    }

    function dice(a, b) {
        if (a.length < 2 || b.length < 2) return 0;
        var grams = {}, hit = 0, i;
        for (i = 0; i < a.length - 1; i++) { var g = a.substr(i, 2); grams[g] = (grams[g] || 0) + 1; }
        for (i = 0; i < b.length - 1; i++) {
            var h = b.substr(i, 2);
            if (grams[h] > 0) { grams[h]--; hit++; }
        }
        return (2 * hit) / (a.length + b.length - 2);
    }

    function score(q, cands) {
        var best = 0;
        for (var i = 0; i < cands.length; i++) {
            var s = norm(cands[i]);
            if (!s) continue;
            var v;
            if (s === q) v = 1;
            else if (s.indexOf(q) === 0) v = 0.9 + 0.09 * (q.length / s.length);
            else if (s.indexOf(q) > -1) v = 0.7;
            else v = 0.6 * dice(q, s);
            if (v > best) best = v;
        }
        return best;
    }

    function rank(input, list, candsOf) {
        var q = norm(input);
        if (!q) return [];
        return list
            .map(function (x, i) { return { x: x, s: score(q, candsOf(x)), i: i }; })
            .filter(function (r) { return r.s > 0.25; })
            .sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    }

    var charCands = function (c) {
        return [c.name].concat(c.shortcuts, c.members);
    };
    var stageCands = function (s) {
        return [s.name].concat(s.shortcuts.split(","));
    };

    // ------------------------------------------------------------ formatting
    function pretty(s) {
        if (!s) return "";
        s = String(s).trim();
        if (/^\d+$/.test(s)) return s + "%+";  // bare number = only the minimum is labbed
        if (/^\d+%$/.test(s)) return s;       // a single exact percent
        if (/^\d+\+$/.test(s)) return s.replace("+", "%+");
        if (/^\d+\+%$/.test(s)) return s.replace("+%", "%+");
        return s.replace(/(\d+)\s*%?\s*-\s*(\d+)\s*%?/g, "$1–$2%").replace(/(\d)(?!\d*%|–|\d)\s*$/, "$1%");
    }

    function bounds(w) {
        var m = /(\d+)\s*%?\s*-\s*(\d+)/.exec(w || "");
        if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
        var one = /^\D*(\d+)\s*%?\s*$/.exec(w || "");
        return one ? [parseInt(one[1], 10), Infinity] : null;
    }

    function row(title, value, note, cls) {
        return '<div class="moreInfo-row' + (cls ? " " + cls : "") + '">' +
            '<div class="moreInfo-title">' + title + "</div>" +
            '<div class="moreInfo-value"><div class="valBody">' + value + "</div>" +
            (note ? '<div class="moreInfo-value-note">' + note + "</div>" : "") +
            "</div></div>";
    }

    function sub(label, val) {
        return '<span class="sub"><span class="lbl">' + label + "</span>" + pretty(val) + "</span>";
    }

    // ------------------------------------------------------------ sections
    // Shown routes (DI out lists only, the common DI):
    //   dthrow > dair > nair > dair > ...        (low percents)
    //   dthrow > (DI guess) dair > uair/wBair/zair/ff > up B
    var ZTD_ROUTE = /^(dair nair dair(\s|$)|dair (uair|wbair|zair|ff) upB$)/i;

    function ztdRows(block) {
        return block.out.filter(function (e) { return ZTD_ROUTE.test(e.seq); });
    }

    function winBounds(w) {
        var n = w.match(/\d+/g).map(Number);
        return [n[0], n[n.length - 1]];
    }

    function fmtSeq(seq) {
        return seq.replace(/\bup B\b/g, "upB").split(/\s+/).join(" → ").replace(/\bupB\b/g, "up B");
    }

    function ztdSection(ch) {
        var stageNames = STAGES.map(function (s) { return s.name; });
        var all = ((D.plan && D.plan[ch.name]) || []).map(function (b) {
            return { label: b.label, rows: ztdRows(b), stage: stageNames.indexOf(b.label) > -1 };
        }).filter(function (b) { return b.rows.length; });
        // A block labelled with a stage (Mario: Battlefield) replaces the standard plan on that stage and is hidden elsewhere.
        var onStage = all.filter(function (b) { return b.stage && b.label === curStage.name; });
        var blocks = all.filter(function (b) { return !b.stage; });
        if (onStage.length) blocks = onStage;
        var html = '<div class="sectionTitle">Luigi Zero To Death (ZTD)</div>';
        if (!blocks.length) {
            return html + '<div class="percentRange noData">No ZTD data</div>' +
                '<div class="ztdSub">No dair → nair → dair route labbed for this character.</div>';
        }
        // standard (unlabelled) group first
        blocks.sort(function (x, y) { return (x.label ? 1 : 0) - (y.label ? 1 : 0); });
        var lo = Infinity, hi = -Infinity;
        blocks[0].rows.forEach(function (r) {
            var b = winBounds(r.w);
            lo = Math.min(lo, b[0]);
            hi = Math.max(hi, b[1]);
        });

        html += '<div class="ztdHeadline">';
        html += '<div class="percentRange">' + lo + " - " + hi + "%</div>";
        html += '<div class="ztdSub">dthrow → dair → … by their percent (DI out)</div>';
        ((D.tumble && D.tumble[ch.name]) || []).forEach(function (t) {
            var rage = Object.keys(t.rage || {}).map(function (k) { return k + "% rage: " + t.rage[k]; }).join(" · ");
            html += '<div class="ztdSub">' + (t.variant ? esc(t.variant) + " — " : "") +
                "dthrow tumbles at <b>" + esc(t.p) + "</b>" + (rage ? '<br><span class="lbl">' + esc(rage) + "</span>" : "") + "</div>";
        });
        html += "</div>";

        html += '<div class="moreInfo">';
        blocks.forEach(function (b) {
            if (b.label && !b.stage) {
                html += '<div class="moreInfo-row"><div class="moreInfo-disclaimer"><b>' + esc(b.label) + "</b></div></div>";
            }
            b.rows.forEach(function (r) {
                html += row(pretty(r.w), esc(fmtSeq(r.seq)), "");
            });
        });
        html += '<div class="moreInfo-row"><div class="moreInfo-disclaimer">Windows by Project L (Venus).</div></div>';
        return html + "</div>";
    }

    function specificSection(ch) {
        var list = (D.charSpecific && D.charSpecific[ch.name]) || [];
        if (!list.length) return "";
        var html = '<div class="sectionTitle">Character specific</div><div class="moreInfo">';
        list.forEach(function (e) {
            var notes = e.notes.map(esc);
            if (e.seq) notes.unshift(esc(e.seq));
            html += row(esc(e.title), pretty(e.window), notes.join("<br>"));
        });
        return html + "</div>";
    }

    function entries(ch, key) {
        return (D.moves[ch.name] && D.moves[ch.name][key]) || [];
    }

    function variantTag(e) {
        return e.variant ? '<span class="lbl">' + esc(e.variant) + "</span>" : "";
    }

    function stageUpB() {
        var bits = [];
        if (typeof curStage.ceiling === "number") {
            bits.push(curStage.ceiling === 0 ? "ceiling: no change" : "ceiling: ~" + Math.abs(curStage.ceiling) + "% earlier");
        }
        var pl = curStage.platforms;
        if (pl) {
            if (pl.all) bits.push("platform: " + pl.all + "% off minimum");
            else bits.push("side platforms: " + pl.side + "% · top platform: " + pl.top + "% off minimum");
        }
        return bits.length ? esc(curStage.name) + " — " + bits.join(" · ") : "";
    }

    function otherSection(ch) {
        var html = '<div class="sectionTitle">Other kill confirms</div><div class="moreInfo">';

        // Dthrow > Up B
        var d = entries(ch, "dthrowUpB");
        if (d.length) {
            var v = d.map(function (e) {
                var s = variantTag(e);
                s += '<span class="sub">' + pretty(e.diOut) + "</span>";
                if (e.difficulty) {
                    var hard = e.difficulty.indexOf("Very") === 0;
                    s += '<span class="badge ' + (hard ? "vhard" : "hard") + '">' + esc(e.difficulty) + "</span>";
                }
                return s;
            }).join("<br>");
            var notes = d.map(function (e) { return e.note ? esc(e.note) : ""; }).filter(Boolean);
            var st = stageUpB();
            html += row("Dthrow → Up B", v, [st].concat(notes).filter(Boolean).join("<br>"));
        } else {
            html += row("Dthrow → Up B", '<span class="noData">not labbed yet</span>');
        }

        // Dthrow > Cyclone
        var c = entries(ch, "dthrowCyclone");
        html += row("Dthrow → Cyclone",
            c.length ? c.map(function (e) { return pretty(e.range); }).join("<br>") : '<span class="noData">not labbed yet</span>',
            c.length ? "Final Destination, DI included, fast-fall cyclone" : "");

        // Utilt > Up B
        var u = entries(ch, "utiltUpB");
        if (u.length) {
            html += row("Utilt → Up B", u.map(function (e) { return variantTag(e) + pretty(e.range); }).join("<br>"),
                u.map(function (e) { return e.note ? esc(e.note) : ""; }).filter(Boolean).join("<br>"));
        } else {
            html += row("Utilt → Up B", '<span class="noData">not labbed yet</span>');
        }

        // Dtilt > Up B
        var dt = entries(ch, "dtiltUpB");
        if (dt.length) {
            html += row("Dtilt → Up B", dt.map(function (e) {
                var t = variantTag(e) + pretty(e.range);
                if (e.fd) t += '<span class="sub"><span class="lbl">FD from</span>' + e.fd + "%</span>";
                return t;
            }).join("<br>"),
                ["Battlefield range"].concat(dt.map(function (e) { return e.note ? esc(e.note) : ""; })).filter(Boolean).join("<br>"));
        } else {
            html += row("Dtilt → Up B", '<span class="noData">not labbed yet</span>');
        }

        // Nair > Up B
        var n = entries(ch, "nairUpB");
        if (n.length) {
            var nv = n.map(function (e) {
                var s = variantTag(e) + pretty(e.kill);
                var late = [];
                if (e.diIn) late.push("DI in " + pretty(e.diIn));
                if (e.noDI) late.push("No DI " + pretty(e.noDI));
                if (e.diOut) late.push("DI out " + pretty(e.diOut));
                if (late.length) s += '<span class="sub"><span class="lbl">Late nair</span>' + late.join(" · ") + "</span>";
                return s;
            }).join("<br>");
            html += row("Nair → Up B", nv, "A single number means only the minimum is labbed");
        } else {
            html += row("Nair → Up B", '<span class="noData">not labbed yet</span>');
        }

        // Nair > Cyclone
        html += row("Nair → Cyclone", '<span class="noData">not labbed yet</span>');

        // Raw Up B KO
        var k = entries(ch, "upBKO");
        if (k.length) {
            html += row("Up B (raw KO)", k.map(function (e) {
                var s = variantTag(e) + "FD ~" + pretty(e.fd).replace("~", "") + " · BF ~" + pretty(e.bf).replace("~", "");
                return s;
            }).join("<br>"), Object.keys(k[0].rage || {}).length ? "Rage: subtract " + rageList(k[0].rage) : "");
        }
        return html + "</div>";
    }

    function rageList(r) {
        if (!r) return "see info";
        return Object.keys(r).map(function (k) { return r[k].replace("Subtract ", "") + " @ " + k + "%"; }).join(", ");
    }

    var DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
    var DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };

    // Moves that hit a ledge hang. "Doesn't work" is already filtered out in the data.
    function ledgeSection(ch) {
        var l = D.ledge && D.ledge[ch.name];
        if (!l) return "";
        var moves = l.moves.slice().sort(function (a, b) { return DIFF_ORDER[a.diff] - DIFF_ORDER[b.diff]; });
        var html = '<div class="sectionTitle">Ledge hang</div><div class="moreInfo">';
        moves.forEach(function (m) {
            html += row(esc(m.move), '<span class="ledge-' + m.diff + '">' + DIFF_LABEL[m.diff] + "</span>", m.note ? esc(m.note) : "");
        });
        if (l.note) {
            html += '<div class="moreInfo-row"><div class="moreInfo-disclaimer">' + esc(l.note) + "</div></div>";
        }
        return html + "</div>";
    }

    // Matchup gameplan: short Do / Don't lists (+ stage advice where the notes have it)
    function gameplanSection(ch) {
        var g = D.matchup && D.matchup[ch.name];
        if (!g) return "";
        function list(items) {
            return items.map(function (t) { return '<span class="sub">• ' + esc(t) + "</span>"; }).join("");
        }
        var html = '<div class="sectionTitle">Gameplan</div><div class="moreInfo">';
        if (g["do"].length) html += row('<span class="gp-do">Do</span>', list(g["do"]), "");
        if (g.dont.length) html += row('<span class="gp-dont">Watch out</span>', list(g.dont), "");
        if (g.stage) html += row("Stage", esc(g.stage), "");
        return html + "</div>";
    }

    // Bair > Dtilt followups, short hop and full hop Bair
    function bairDtilt(ch) {
        var b = D.bairDtilt && D.bairDtilt[ch.name];
        if (!b) return "";
        var html = '<div class="sectionTitle">wBair → Dtilt followups</div>' +
            '<div class="ztdSub">land wBair → turn around Dtilt → then:</div><div class="moreInfo">';
        [["sh", "Short hop"], ["fh", "Full hop"]].forEach(function (k) {
            var e = b[k[0]];
            if (!e) return;
            var notes = [];
            if (e.dmg) notes.push("deals " + esc(e.dmg) + "%");
            if (e.note) notes.push(esc(e.note));
            html += row(k[1], esc(e.seq), notes.join("<br>"));
        });
        return html + "</div>";
    }

    var TIER_LABEL = { 1: "Easy", 2: "Needs spacing", 3: "Strict spacing", 4: "2 hits to poke" };

    function tierText(t, text) {
        return '<span class="tier-' + t + '">' + esc(text) + "</span>";
    }

    // Shield poking: how to poke through the opponent's shield. "Can't poke" (tier 0) is left out.
    function pokeSection(ch) {
        var list = (D.poke && D.poke[ch.name]) || [];
        if (!list.length) return "";
        var html = '<div class="sectionTitle">Shield poke</div><div class="moreInfo">';
        list.forEach(function (e) {
            var pre = e.variant ? esc(e.variant) + " — " : "";
            if (e.floor && e.floor.tier > 0) {
                var notes = (e.alts || []).map(function (a) {
                    return "Tier " + a.tier + ": " + esc(a.move);
                }).concat((e.notes || []).map(esc));
                html += row("Floor", pre + tierText(e.floor.tier, e.floor.move), notes.join("<br>"));
            } else if (e.notes && e.notes.length) {
                html += row("Floor", '<span class="noData">no floor poke</span>', e.notes.map(esc).join("<br>"));
            }
            [["front", "Front foot"], ["back", "Back foot"], ["head", "Head"]].forEach(function (p) {
                var t = e.parts && e.parts[p[0]];
                if (t > 0) html += row(p[1], tierText(t, TIER_LABEL[t]), "");
            });
        });
        return html + "</div>";
    }

    function crouchItems(ch) {
        return (D.crouch && D.crouch[ch.name]) || [];
    }

    function crouchNote(ch) {
        var items = crouchItems(ch);
        if (!items.length) return "";
        return '<div class="crouchNote"><span class="lbl">Crouch under</span>' + items.map(esc).join(" · ") + "</div>";
    }

    function charSection(ch, withHeading) {
        var html = "";
        if (withHeading) {
            html += '<div class="charIco" style="background-position-x:' + ((ch.sprite - 1) * -50) + 'px"></div>' +
                '<div class="charSubTitle">' + esc(ch.name) + "</div>";
        }
        return html + crouchNote(ch) + ztdSection(ch) + specificSection(ch) + gameplanSection(ch) + otherSection(ch) + bairDtilt(ch) + ledgeSection(ch) + pokeSection(ch);
    }

    // ------------------------------------------------------------ render
    function render() {
        var members = curChar.members.length
            ? curChar.members.map(function (n) { return byName[n]; }).filter(Boolean)
            : [curChar];
        var icons = members.map(function (m) {
            return '<div class="charIco" style="background-position-x:' + ((m.sprite - 1) * -50) + 'px"></div>';
        }).join("");
        document.querySelector(".charIcons").innerHTML = icons;
        document.getElementById("charTitle").textContent = curChar.name;
        document.getElementById("stageName").textContent = curStage.name;
        document.getElementById("stageIco").style.backgroundPositionX = ((curStage.sprite - 1) * -100) - 9 + "px";
        document.querySelector(".charInfo").innerHTML =
            members.map(function (m) { return charSection(m, members.length > 1); }).join("");
    }

    function chips(id, matches, label, pick) {
        var el = document.getElementById(id);
        el.innerHTML = "";
        matches.slice(1, 6).forEach(function (r) {
            var b = document.createElement("button");
            b.textContent = label(r.x);
            b.onclick = function () { pick(r.x); };
            el.appendChild(b);
        });
    }

    function updateChar() {
        var input = document.getElementById("char").value;
        var m = rank(input, roster, charCands);
        if (m.length) curChar = m[0].x;
        else if (!input) curChar = byName["Mario"];
        chips("charChips", m, function (c) { return c.name; }, function (c) {
            document.getElementById("char").value = c.name;
            updateChar();
        });
        render();
    }

    function updateStage() {
        var input = document.getElementById("stage").value;
        var m = rank(input, STAGES, stageCands);
        if (m.length) curStage = m[0].x;
        else if (!input) curStage = STAGES[0];
        chips("stageChips", m, function (s) { return s.name; }, function (s) {
            document.getElementById("stage").value = s.name;
            updateStage();
        });
        render();
    }

    // ------------------------------------------------------------ page chrome
    window.toggleTheme = function () {
        var root = document.documentElement;
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        store("theme", next);
        buildLedgeTips();
    syncThemeIcon();
    };

    function syncThemeIcon() {
        var el = document.querySelector(".themeToggle");
        if (el) el.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀" : "🌙";
    }

    function showPage() {
        var info = window.location.hash === "#info";
        document.querySelector(".main").style.display = info ? "none" : "block";
        document.querySelector(".info").style.display = info ? "block" : "none";
    }

    window.toggleInfo = function () {
        window.location.hash = window.location.hash === "#info" ? "" : "info";
    };
    window.goBack = function () { window.location.hash = ""; };
    window.clearAndFocus = function (id) {
        var el = document.getElementById(id);
        el.value = "";
        el.focus();
        id === "char" ? updateChar() : updateStage();
    };

    function buildLedgeTips() {
        var t = document.getElementById("ledgeTips");
        if (!t) return;
        t.innerHTML = (D.ledgeTips || []).map(function (x) {
            return "<tr><td width=\"32%\"><b>" + esc(x.move) + "</b></td><td>" + esc(x.text) + "</td></tr>";
        }).join("");
    }

    window.addEventListener("hashchange", showPage);
    document.getElementById("char").addEventListener("input", updateChar);
    document.getElementById("stage").addEventListener("input", updateStage);
    // "[" focuses character, "]" focuses stage (same as monke.gg)
    document.addEventListener("keypress", function (e) {
        if (e.target.tagName === "INPUT") return;
        if (e.key === "[") { e.preventDefault(); clearAndFocus("char"); }
        else if (e.key === "]") { e.preventDefault(); clearAndFocus("stage"); }
    });

    syncThemeIcon();
    showPage();
    render();
})();
