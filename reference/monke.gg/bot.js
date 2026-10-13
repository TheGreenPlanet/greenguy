var curStage;
var stages;
var curChar;
var chars;

var cacheSfx = '?2_20_26';
var stagesURL = 'stages.json' + cacheSfx;

// Create the chars array
var chars = [];

// Array of files to parse
var dataFiles = [
  { Name: "pDKO", File: "pDKO.csv" },
  { Name: "apDKO", File: "apDKO.csv" },
  { Name: "aDKO", File: "aDKO.csv" },
  { Name: "gDKO", File: "gDKO.csv" },
  { Name: "aHSUsmash", File: "aHSUSmash.csv" },
  { Name: "aHS12Untechable", File: "aHS12Untechable.csv" },
  { Name: "HeadbuttUsmash", File: "HeadbuttUSmash.csv" },
  { Name: "Tips", File: "Tips.csv" },
  { Name: "Dtilt", File: "Dtilt.csv" },
  { Name: "Data", File: "data.csv" }
];

var processedFiles = 0;

// Buff colors
var BUFF_COLORS = {
    "Limit": "6ea8ff",
    "Acceleratle": "75ff6e",
    "Oomph": "ff6e6e",
    "Jump": "6eff73",
    "Speed": "6efdff",
    "Shield": "fff86e",
    "Buster": "996eff",
    "Smash": "ff6e6e",
    "Deep Breathing": "ff6e6e"
}

// Helper function to find or create character entry in the array
function findOrCreateCharacter(charsArray, characterName) {
    let char = charsArray.find(c => c.Name === characterName);
    if (!char) {
        char = { Name: characterName, Buffs: [] }; // Initialize Buffs as an empty array
        charsArray.push(char);
    }
    return char;
}

// Helper function to find or create buff entry for a character
function findOrCreateBuff(charData, buffName) {
    var buff = charData.Buffs.find(b => b.Name === buffName);
    if (!buff) {
        buff = { Name: buffName };
        charData.Buffs.push(buff);
    }
    return buff;
}

function updateLoadingBar(amount) {
	const loadingBar = document.getElementById('loadingBar');
	loadingBar.style.width = amount + '%';
}

function parseCSV(input, options = {}) {
    const defaults = {
        separator: ",",
        delimiter: '"',
        start: 1,
        end: undefined,
        onPreParse: null,
        onPostParse: null,
        onParseEntry: null,
        onParseValue: null
    };

    // Merge user options with defaults
    const config = { ...defaults, ...options };
    config.state = { rowNum: 1, colNum: 1 };

    if (config.onPreParse) {
        input = config.onPreParse(input, config.state);
    }

    const separator = config.separator;
    const delimiter = config.delimiter;

    let output = [];
    let currentRow = [];
    let currentValue = '';
    let state = 0; // 0 = unquoted, 1 = inside-quote, 2 = quote-end, 3 = non-quoted field

    const separatorRegex = new RegExp(RegExp.escape(separator));
    const delimiterRegex = new RegExp(RegExp.escape(delimiter));
    const tokenRegex = new RegExp(`(${RegExp.escape(delimiter)}|${RegExp.escape(separator)}|\\r\\n|\\n|\\r|[^${RegExp.escape(delimiter)}${RegExp.escape(separator)}\\r\\n]+)`, 'gm');

    input.replace(tokenRegex, function (token) {
        if (state === 0) {
            if (token === separator) {
                currentRow.push(currentValue);
                currentValue = '';
            } else if (token === delimiter) {
                state = 1;
            } else if (token === '\n' || token === '\r\n' || token === '\r') {
                currentRow.push(currentValue);
                if (!config.start || config.state.rowNum >= config.start) {
                    output.push(currentRow);
                }
                currentRow = [];
                currentValue = '';
                config.state.rowNum++;
                config.state.colNum = 1;
            } else {
                currentValue += token;
                state = 3;
            }
        } else if (state === 1) {
            if (token === delimiter) {
                state = 2;
            } else {
                currentValue += token;
            }
        } else if (state === 2) {
            if (token === delimiter) {
                currentValue += delimiter; // escaped quote
                state = 1;
            } else if (token === separator) {
                currentRow.push(currentValue);
                currentValue = '';
                state = 0;
            } else if (token === '\n' || token === '\r\n' || token === '\r') {
                currentRow.push(currentValue);
                if (!config.start || config.state.rowNum >= config.start) {
                    output.push(currentRow);
                }
                currentRow = [];
                currentValue = '';
                config.state.rowNum++;
                config.state.colNum = 1;
                state = 0;
            }
        } else if (state === 3) {
            if (token === separator) {
                currentRow.push(currentValue);
                currentValue = '';
                state = 0;
            } else if (token === '\n' || token === '\r\n' || token === '\r') {
                currentRow.push(currentValue);
                if (!config.start || config.state.rowNum >= config.start) {
                    output.push(currentRow);
                }
                currentRow = [];
                currentValue = '';
                config.state.rowNum++;
                config.state.colNum = 1;
                state = 0;
            } else {
                currentValue += token;
            }
        }
    });

    if (currentValue !== '' || currentRow.length > 0) {
        currentRow.push(currentValue);
        if (!config.start || config.state.rowNum >= config.start) {
            output.push(currentRow);
        }
    }

    if (config.onPostParse) {
        output = config.onPostParse(output, config.state);
    }

    return output;
}

RegExp.escape = function (str) {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
};

function processFile(fileInfo) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/' + fileInfo.File + cacheSfx, true);
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = xhr.responseText;

                // Parse CSV data into an array of arrays using custom parseCSV function
                const parsedData = parseCSV(data);

                // Extract the headers from the first row
                const headers = parsedData[0];

                // Loop through the rest of the rows (skip header row)
                for (let i = 1; i < parsedData.length; i++) {
                    const row = parsedData[i];

                    // Handle empty rows (this prevents errors when there are blank lines)
                    if (row.length === 0 || row[0] === '') continue;

                    // Split the character name to detect if it contains a buff in parentheses
                    const nameMatch = row[0].match(/^(.*?)(?: \((.*?)\))?$/);
                    const baseName = nameMatch[1].trim();
                    const buffName = nameMatch[2] ? nameMatch[2].trim() : null;

                    // Find or create the base character in the array
                    const charData = findOrCreateCharacter(chars, baseName);

                    if (buffName) {
                        const buffData = findOrCreateBuff(charData, buffName);
                        if (!buffData[fileInfo.Name]) {
                            buffData[fileInfo.Name] = {};
                        }

                        for (let j = 1; j < headers.length; j++) {
                            let value = row[j];
                            if (fileInfo.Name === "HeadbuttUsmash") {
                                if (value === "TRUE") value = true;
                                else if (value === "FALSE") value = false;
                            } else if (!isNaN(value) && value.trim() !== "") {
                                value = parseFloat(value);
                            }
                            buffData[fileInfo.Name][headers[j]] = value === "" ? null : value;
                        }
                    } else {
                        if (fileInfo.Name === "Data") {
                            for (let j = 1; j < headers.length; j++) {
                                let value = row[j];
                                if (!isNaN(value) && value.trim() !== "") {
                                    value = parseFloat(value);
                                }
                                charData[headers[j]] = value === "" ? null : value;
                            }
                        } else {
                            if (!charData[fileInfo.Name]) {
                                charData[fileInfo.Name] = {};
                            }
                            for (let j = 1; j < headers.length; j++) {
                                let value = row[j];
                                if (fileInfo.Name === "HeadbuttUsmash") {
                                    if (value === "TRUE") value = true;
                                    else if (value === "FALSE") value = false;
                                } else if (!isNaN(value) && value.trim() !== "") {
                                    value = parseFloat(value);
                                }
                                charData[fileInfo.Name][headers[j]] = value === "" ? null : value;
                            }
                        }
                    }
                }

                processedFiles++;
                updateLoadingBar((processedFiles / dataFiles.length) * 100);
                resolve(); // Resolve the promise when the file processing is done
            } else {
                console.error('❌ Error processing file:', fileInfo.File, 'Status:', xhr.status);
                reject(new Error('Request failed with status ' + xhr.status));
            }
        };

        xhr.onerror = function() {
            console.error('❌ Network error while processing file:', fileInfo.File);
            reject(new Error('Network error'));
        };

        xhr.send();
    });
}

function getCurPage() {
	return window.location.hash.slice(1);
}

function compareTwoStrings(first, second) {
	first = first.replace(/\s+/g, '').toLowerCase();
	second = second.replace(/\s+/g, '').toLowerCase();

	if (first === second) return 1; // identical or empty
	if (first.length < 2 || second.length < 2) return 0; // if either is a 0-letter or 1-letter string

	let firstBigrams = new Map();
	for (let i = 0; i < first.length - 1; i++) {
		const bigram = first.substring(i, i + 2);
		const count = firstBigrams.has(bigram)
			? firstBigrams.get(bigram) + 1
			: 1;

		firstBigrams.set(bigram, count);
	};

	let intersectionSize = 0;
	for (let i = 0; i < second.length - 1; i++) {
		const bigram = second.substring(i, i + 2);
		const count = firstBigrams.has(bigram)
			? firstBigrams.get(bigram)
			: 0;

		if (count > 0) {
			firstBigrams.set(bigram, count - 1);
			intersectionSize++;
		}
	}

	return (2.0 * intersectionSize) / (first.length + second.length - 2);
}

function areArgsValid(mainString, targetStrings) {
	if (typeof mainString !== 'string') return false;
	if (!Array.isArray(targetStrings)) return false;
	if (!targetStrings.length) return false;
	if (targetStrings.find( function (s) { return typeof s !== 'string'})) return false;
	return true;
}

function findBestMatch(mainString, targetStrings) {
	if (!areArgsValid(mainString, targetStrings)) throw new Error('Bad arguments: First argument should be a string, second should be an array of strings');
	
	const ratings = [];
	let bestMatchIndex = 0;

	for (let i = 0; i < targetStrings.length; i++) {
		const currentTargetString = targetStrings[i];
		const currentRating = compareTwoStrings(mainString, currentTargetString)
		ratings.push({target: currentTargetString, rating: currentRating})
		if (currentRating > ratings[bestMatchIndex].rating) {
			bestMatchIndex = i
		} 
	}
	
	
	const bestMatch = ratings[bestMatchIndex]
	
	return { ratings: ratings, bestMatch: bestMatch, bestMatchIndex: bestMatchIndex };
}

function cleanString(str) {
	return str.replace(/\s+/g, '').trim();
}

function addPlus(min) {
	if (min["Percent"] >= 0) {
		return "+" + min["Percent"];
	} else {
		return min["Percent"];
	}
}

function pctInfo(ch, char) {
    let charOpt = ch.Optimized;
    let charMin = ch.Minimum;
    let charMax = ch.Maximum;
    let wasChange = false;

    curStage = curStage ? curStage : stages.find(stage => stage.Name === "Pokémon Stadium 2");

    console.log(ch);
    if (curStage.Name === "Final Destination" && char != null && char.Name === "Steve") {
        return ["[62] 65 - 75", "<div class=\"notice\">You can pDKO Steve on a stack of 3 blocks.</div>"];
    } else if (curStage.Name === "Final Destination") {
        return ["N/A", "<div class=\"impossible\">You cannot pDKO on this stage.</div>"];
    }

    let numValid = 0;
    const numWindows = curStage.Minimums.length;

    let prefMin = curStage.Minimums[0];
    let bestMin = prefMin;
    let otherMin = prefMin;

    curStage.Minimums.forEach(min => {
        if (charMin + min.Percent <= charMax) {
            numValid++;
        }
        if (min.Percent < bestMin.Percent) {
            bestMin = min;
        }
        if (min !== prefMin) {
            otherMin = min;
        }
    });

    if (numValid < numWindows) {
        charOpt += bestMin.Percent;
        charMin += bestMin.Percent;
    } else {
        charOpt += prefMin.Percent;
        charMin += prefMin.Percent;
    }

    if (charMin !== ch.Minimum) {
        wasChange = true;
    }

    const bestMinName = bestMin.Name ? `${bestMin.Name}: ` : '';
    const prefMinName = prefMin.Name ? `${prefMin.Name}: ` : '';
    const otherMinName = otherMin.Name ? otherMin.Name : '';

    let stageNote;
    if (curStage.Name === "Pokémon Stadium 2") {
        stageNote = "";
    } else if (numValid === 0) {
        stageNote = "<div class=\"impossible\">You cannot pDKO this character on this stage.</div><br>";
    } else if (numValid < numWindows) {
        stageNote = `<div class="notice">You can only pDKO on the ${bestMinName}(${addPlus(bestMin)})</div><br>`;
    } else {
        stageNote = `<span class="percentInf">(<span class="percentHighlight">${prefMinName}${addPlus(prefMin)}</span>${numWindows > 1 ? `, ${otherMinName}: ${addPlus(otherMin)}` : ''})</span><br>`;
    }

    const startTag = wasChange ? "<span class=\"percentHighlight\">" : "";
    const endTag = wasChange ? "</span>" : "";
    let percentInfo = `[${startTag}${charOpt}${endTag}] ${startTag}${charMin}${endTag} - ${charMax}`;

    if (wasChange) {
        percentInfo = `${startTag}${charMin}${endTag} - ${charMax}`;
    }

    return [percentInfo, stageNote];
}

function renderPctInfo(info) {
	var opt = info["Optimized"] ? `[${info["Optimized"]}] ` : ''; // Check and format optimized value
	var note = info["Note"] ? `  <div class="moreInfo-value-note">${info["Note"]}</div>` : ''; // Check and format note
	return `${opt}${info["Minimum"]} - ${info["Maximum"]}${note}`;
}

const infoTitles = {
	"gDKO": "gDKO",
	"aDKO": "aDKO",
	"apDKO": "apDKO",
	"aHSUsmash": "aHS to Up Smash",
	"aHS12Untechable": "aHS12 Untechable"
};

function updateChar(force) {
    let charInp = force || document.getElementById("char").value;
    charInp = charInp !== "" ? charInp : "Donkey Kong";

    let lookupChar;
    let searchingRating = 0;

    chars.forEach(char => {
        let shortcutStrs = char["Shortcut Strings"] || "";
        const shortcuts = cleanString(shortcutStrs).split(",").concat(char.Name);
        const search = findBestMatch(charInp, shortcuts);
        
        if (search.bestMatch.rating > searchingRating) {
            lookupChar = char;
            searchingRating = search.bestMatch.rating;
        }
    });

    if (!lookupChar) return;

    curChar = lookupChar;

    document.getElementById("charTitle").innerHTML = curChar.Name;

    const allChars = curChar.Characters 
        ? cleanString(curChar.Characters).split(',').map(ch => chars.find(char => char.Name === ch)).filter(Boolean) 
        : [curChar];

    updateCharInfo(allChars);
}

function updateCharInfo(allChars) {
    const charIconsElement = document.querySelector('.charIcons');
    const charInfoElement = document.querySelector('.charInfo');

    charIconsElement.innerHTML = '';
    charInfoElement.innerHTML = '';

    allChars.forEach(ch => {
        const charIco = document.createElement('div');
        charIco.className = 'charIco';
        charIco.id = `char${ch.Name}`;
        charIco.style.backgroundPositionX = `${((parseInt(ch.Sprite) - 1) * -50)}px`;
        charIconsElement.appendChild(charIco);

        const [percentInfo, stageNote] = pctInfo(ch.pDKO, ch);
        appendCharInfo(ch, percentInfo, stageNote);
    });
}

function appendCharInfo(ch, percentInfo, stageNote) {
    const charInfoElement = document.querySelector('.charInfo');

    // Append charSubtitle directly to charInfo
    if (curChar.Characters) {
		const charIco = document.createElement('div');
        charIco.className = 'charIco';
        charIco.id = `char${ch.Name}`;
        charIco.style.backgroundPositionX = `${((parseInt(ch.Sprite) - 1) * -50)}px`;
        charInfoElement.appendChild(charIco);

        const charSubTitle = document.createElement('div');
        charSubTitle.className = 'charSubTitle';
        charSubTitle.textContent = ch.Name;
        charInfoElement.appendChild(charSubTitle);
    }

    // Append percent info only if the stage is not "impossible"
    if (!stageNote.includes('class="impossible"')) {
        const percentInfoElement = document.createElement('div');
		percentInfoElement.className = 'percentRange';
        percentInfoElement.innerHTML = percentInfo;
        charInfoElement.appendChild(percentInfoElement);
    }

    // Append stageNote directly to charInfo
    charInfoElement.insertAdjacentHTML('beforeend', stageNote);

    appendMoreInfo(ch);

    // Handle buffs if any
    if (curChar.Buffs) {
        curChar.Buffs.forEach(buff => {
            const buffColor = BUFF_COLORS[buff.Name];

            // Append buff title and percent info directly to charInfo for buffs
            const buffTitle = document.createElement('div');
            buffTitle.className = 'charSubTitle';
            buffTitle.style.color = `#${buffColor}`;
            buffTitle.textContent = buff.Name;
            charInfoElement.appendChild(buffTitle);

            const [buffInfo, buffStageNote] = pctInfo(buff.pDKO);
            
            if (!buffStageNote.includes('class="impossible"')) {
                const buffInfoElement = document.createElement('div');
				buffInfoElement.className = 'percentRange';
                buffInfoElement.innerHTML = buffInfo;
                charInfoElement.appendChild(buffInfoElement);
            }

            // Append buff stage note and moreInfo if applicable
            charInfoElement.insertAdjacentHTML('beforeend', buffStageNote);
            appendMoreInfo(buff);
        });
    }
}

function appendMoreInfo(ch) {
    let hasContent = false;
    let isPercent = false;

    const moreInfoDiv = document.createElement('div');
    moreInfoDiv.className = 'moreInfo';

    // Check and append properties
    const infoProperties = ["gDKO", "aDKO", "apDKO", "aHSUsmash"];
    infoProperties.forEach(prop => {
        if (ch[prop] && ch[prop].Minimum != null && ch[prop].Minimum) {
            appendInfoElement(moreInfoDiv, infoTitles[prop], renderPctInfo(ch[prop]));
            hasContent = true;
            isPercent = true;
        }
    });

    if (ch["aHS12Untechable"] != null && ch["aHS12Untechable"]["Percent"] != null) {
        appendInfoElement(moreInfoDiv, infoTitles["aHS12Untechable"], ch["aHS12Untechable"]["Percent"]);
        hasContent = true;
        isPercent = true;
    }

    if (ch.Dtilt && ch.Dtilt["Low"] != null && ch.Dtilt["MaxRage"] != null) {
        appendInfoElement(moreInfoDiv, "D-tilt trip", `0 - ${ch.Dtilt["Low"]}<br>0 - ${ch.Dtilt["MaxRage"]} (at max rage)`);
        hasContent = true;
    }

    if (ch["HeadbuttUsmash"] != null) {
        appendInfoElement(moreInfoDiv, "Headbutt to Up Smash", ch["HeadbuttUsmash"]["HeadbuttUsmash"] ? "Yes" : "No");
        hasContent = true;
        isPercent = true;
    }

    if (ch["Tips"] != null && ch["Tips"]["Neutral"] != null) {
        appendInfoElement(moreInfoDiv, "Neutral", ch["Tips"]["Neutral"]);
        hasContent = true;
    }

    // Append the disclaimer and moreInfoDiv only if there is content
    if (hasContent) {
        if (isPercent) {
            const disclaimer = document.createElement('div');
            disclaimer.className = 'moreInfo-row';
            disclaimer.innerHTML = '<div class="moreInfo-disclaimer">All percents in this box are for PS2 / FD.</div>';
            moreInfoDiv.appendChild(disclaimer);
        }
        document.querySelector('.charInfo').appendChild(moreInfoDiv);
    }
}

function appendInfoElement(moreInfoDiv, title, value) {
    const valueClass = title === "Headbutt to Up Smash" ? (value === "Yes" ? 'yes-color' : 'no-color') : '';
    
    const infoRow = document.createElement('div');
    infoRow.className = 'moreInfo-row';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'moreInfo-title';
    titleDiv.textContent = title;
    
    const valueDiv = document.createElement('div');
    valueDiv.className = `moreInfo-value ${valueClass}`;
    valueDiv.innerHTML = value;
    
    infoRow.appendChild(titleDiv);
    infoRow.appendChild(valueDiv);
    
    moreInfoDiv.appendChild(infoRow);
}

function updateStage() {
    const stageInp = document.getElementById("stage").value;
    let lookupStage;
    let searchingRating = 0;

    stages.forEach(stage => {
        const shortcuts = cleanString(stage["Shortcuts"]).split(",").concat(stage.Name);
        const search = findBestMatch(stageInp, shortcuts);
        
        if (search.bestMatch.rating > searchingRating) {
            lookupStage = stage;
            searchingRating = search.bestMatch.rating;
        }
    });

    curStage = lookupStage ? lookupStage : stages[3];

    document.getElementById('stageIco').style.backgroundPositionX = `${((curStage.Sprite - 1) * -100) - 9}px`;
    document.getElementById('stageName').innerHTML = curStage.Name;
    
    updateChar();
}

function toggleTheme() {
    const root = document.documentElement;
    const themeToggle = document.querySelector('.themeToggle');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (themeToggle) {
        themeToggle.textContent = newTheme === 'dark' ? '☀' : '🌙';
        themeToggle.setAttribute('title', 'Toggle light/dark mode');
    }
    if (metaTheme) {
        metaTheme.setAttribute('content', newTheme === 'dark' ? '#000000' : '#f5f5f0');
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);

    const themeToggle = document.querySelector('.themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀' : '🌙';
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f0');
    }
}

function toggleInfo() {
    if (getCurPage() !== "info") {
        window.location.hash = "info";
    } else {
        window.location.replace("#");

        if (typeof window.history.replaceState === 'function') {
            history.replaceState({}, '', window.location.href.slice(0, -1));
        }
    }
}

function goBack() {
    window.location.replace("#");

    if (typeof window.history.replaceState === 'function') {
        history.replaceState({}, '', window.location.href.slice(0, -1));
    }
}

function clearAndFocus(element) {
    const inputElement = document.getElementById(element);
    if (inputElement) {
        inputElement.value = '';
        inputElement.focus();
    }
    updateStage();
}

function fadeInDiv() {
	const div = document.getElementById('infoBody');
	div.classList.remove('infoBodyHidden');
	div.classList.add('infoBody');
}

window.addEventListener('hashchange', function() { // detect hash change
    const hash = window.location.hash.slice(1);

    if (hash === "info") {
        document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.info').forEach(el => el.style.display = 'block');
    } else {
        document.querySelectorAll('.main').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.info').forEach(el => el.style.display = 'none');
    }
});

function onDOMReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

onDOMReady(function() {
    initTheme();
    if (getCurPage() === "info") {
        document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.info').forEach(el => el.style.display = 'block');
    } else {
        document.querySelectorAll('.main').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.info').forEach(el => el.style.display = 'none');
    }
});

const xhr = new XMLHttpRequest();
xhr.open('GET', stagesURL, true);
xhr.responseType = 'json';

xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
        stages = xhr.response;
        curStage = stages[3];

        const promises = dataFiles.map(fileInfo => processFile(fileInfo));
        Promise.all(promises)
            .then(() => {
                updateStage();
                document.getElementById('loading').remove();
                fadeInDiv();
            })
            .catch(error => {
                console.error('❌ Error processing files:', error);
            });
    } else {
        console.error('❌ Request failed! Status:', xhr.status);
    }
};

xhr.onerror = function() {
    console.error('❌ Network error occurred!');
};

xhr.send();


document.addEventListener('keypress', function(e) {
    if (e.which === 91) {
        clearAndFocus('char');
        e.preventDefault();
    } else if (e.which === 93) {
        clearAndFocus('stage');
        e.preventDefault();
    }
});