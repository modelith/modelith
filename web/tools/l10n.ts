// 文言の辞書の検査（ADR-0027 の 6）。判断だけの純粋関数で、ファイルの読み書きは l10n-cli.ts が行う。
// - 辞書（.ftl）のキーと値の名前が決まりどおりか
// - 移し終えたフォルダのコードに、文が直接書かれていないか
// - コードが使うキーが辞書にあり、辞書のキーがどれも使われているか

/** 見つけた誤り。line は 1 始まり。 */
export interface Finding {
  line: number;
  message: string;
}

/** 日本語の文字（ひらがな・カタカナ・漢字）と、日本語の文で使う記号。これがコードにあれば、文を直接書いている。 */
const JAPANESE = /[ぁ-ゖァ-ヺ一-鿿、。「-』！-～]/;

/** この語を書いた行（とその次の行）は、文の直書きの検査から外す（文字の種類を調べる正規表現など）。 */
const IGNORE_MARK = "l10n-ignore";

/** 直後の `/` が、割り算ではなく正規表現の始まりになる記号。 */
const BEFORE_REGEX = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
/** 直後の `/` が正規表現の始まりになる語。 */
const WORD_BEFORE_REGEX = /(?:^|[^\w$])(?:return|typeof|case|of|in|void|delete|throw|new|else|do)$/;

/**
 * TypeScript のコメントを、同じ長さの空白に置き換える（行の数と位置は変えない）。文字列・テンプレート・正規表現の中の `//` はコメントにしない。
 *
 * @param source TypeScript のソース
 * @returns コメントを空白にしたソース
 * @example
 * stripTsComments('const a = "x"; // 説明')      // → 'const a = "x";        '
 * stripTsComments('const u = "http://a"; /* b *\/') // → 'const u = "http://a";        '
 */
export function stripTsComments(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  /** 直前の、空白でない文字（正規表現の始まりかを決める）。 */
  let prev = "";
  /** 引用符で囲んだ文字列を読み飛ばす。from は開く引用符の位置。戻り値は閉じた次の位置。 */
  const skipQuoted = (from: number): number => {
    const quote = source[from];
    let k = from + 1;
    while (k < source.length && source[k] !== quote && source[k] !== "\n") k += source[k] === "\\" ? 2 : 1;
    return k + 1;
  };
  /** 正規表現を読み飛ばす。from は開く `/` の位置。 */
  const skipRegex = (from: number): number => {
    let k = from + 1;
    let inClass = false;
    while (k < source.length && source[k] !== "\n") {
      const c = source[k];
      if (c === "\\") k++;
      else if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) break;
      k++;
    }
    return k + 1;
  };
  /** コードを読む。inTemplate のときは、対応する `}` で戻る（テンプレートの `${ … }` の中）。 */
  const code = (from: number, inTemplate: boolean): number => {
    let i = from;
    let depth = 0;
    while (i < source.length) {
      const c = source[i] ?? "";
      const two = source.slice(i, i + 2);
      if (two === "//") {
        const end = source.indexOf("\n", i);
        const stop = end < 0 ? source.length : end;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (two === "/*") {
        const end = source.indexOf("*/", i + 2);
        const stop = end < 0 ? source.length : end + 2;
        blank(i, stop);
        i = stop;
        continue;
      }
      if (c === '"' || c === "'") {
        i = skipQuoted(i);
        prev = '"';
        continue;
      }
      if (c === "`") {
        i = template(i + 1);
        prev = '"';
        continue;
      }
      if (c === "/" && (BEFORE_REGEX.has(prev) || WORD_BEFORE_REGEX.test(source.slice(Math.max(0, i - 12), i).trimEnd()))) {
        i = skipRegex(i);
        prev = '"';
        continue;
      }
      if (c === "{") depth++;
      if (c === "}") {
        if (inTemplate && depth === 0) return i + 1;
        depth--;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    return i;
  };
  /** テンプレートを読む。from は開く「`」の次の位置。戻り値は閉じた次の位置。 */
  const template = (from: number): number => {
    let i = from;
    while (i < source.length && source[i] !== "`") {
      if (source[i] === "\\") i += 2;
      else if (source.startsWith("${", i)) {
        prev = "{";
        i = code(i + 2, true);
      } else i++;
    }
    return i + 1;
  };
  code(0, false);
  return out.join("");
}

/**
 * コードに直接書かれた文（日本語を含む行）を探す。コメントは見ない。
 *
 * @param source TypeScript のソース
 * @returns 文が直接書かれた行。`l10n-ignore` と書いた行と、その次の行は除く
 * @example
 * hardcodedText('toast("保存しました"); // 知らせる') // → [{ line: 1, message: 'toast("保存しました");' }]
 * hardcodedText('toast(t("saved")); // 知らせる')     // → []
 */
export function hardcodedText(source: string): Finding[] {
  const original = source.split("\n");
  return stripTsComments(source)
    .split("\n")
    .flatMap((text, k) => {
      if (!JAPANESE.test(text)) return [];
      if (original[k]?.includes(IGNORE_MARK) || original[k - 1]?.includes(IGNORE_MARK)) return [];
      return [{ line: k + 1, message: text.trim() }];
    });
}

/**
 * 辞書（.ftl）のキーを取り出し、決まり（ADR-0027 の 2）に合わない所を探す。
 *
 * @param ftl 辞書の中身
 * @returns keys は辞書のキー（書いた順）。problems は、小文字の英字・数字・`-` でないキー、2 回書いたキー、英字と数字でない値の名前、読めない行
 * @example
 * checkDictionary("saved = 「{ $name }」を保存しました\n") // → { keys: ["saved"], problems: [] }
 * checkDictionary("Saved = a\n")                           // → { keys: [], problems: [{ line: 1, message: "キー「Saved」は…" }] }
 */
export function checkDictionary(ftl: string): { keys: string[]; problems: Finding[] } {
  const keys: string[] = [];
  const problems: Finding[] = [];
  ftl.split("\n").forEach((text, k) => {
    const line = k + 1;
    for (const m of text.matchAll(/\{\s*\$([^\s}]+)/g)) {
      const name = m[1] ?? "";
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) problems.push({ line, message: `値の名前「${name}」は、英字と数字だけにしてください` });
    }
    // 空の行・コメント・前の行の続き（字下げした行と、選び分けを閉じる「}」）は、キーの行ではない
    if (text.trim() === "" || text.startsWith("#") || /^\s/.test(text) || text.trim() === "}") return;
    const key = /^([^\s=]+)\s*=/.exec(text)?.[1];
    if (key === undefined) problems.push({ line, message: `読めない行です（「キー = 文」の形にしてください）：${text}` });
    else if (!/^[a-z][a-z0-9-]*$/.test(key)) problems.push({ line, message: `キー「${key}」は、小文字の英字・数字・「-」だけにしてください` });
    else if (keys.includes(key)) problems.push({ line, message: `キー「${key}」が 2 回書かれています` });
    else keys.push(key);
  });
  return { keys, problems };
}

/**
 * 1 つの言語の辞書（場所ごとのファイル）をまとめて確かめる。ファイルごとの決まり（checkDictionary）に加えて、
 * キーがファイルの名前で始まること（`render.ftl` のキーは `render-…`）と、同じキーがほかのファイルに無いことを確かめる。
 *
 * @param files 辞書のファイル（拡張子を除いた名前と中身）
 * @returns keys はすべてのキー。problems は誤り（どのファイルの何行目か）
 * @example
 * checkDictionaries([{ name: "files", source: "files-a = 1\n" }])  // → { keys: ["files-a"], problems: [] }
 * checkDictionaries([{ name: "files", source: "core-a = 1\n" }])
 * // → { keys: ["core-a"], problems: [{ file: "files", line: 1, message: "キー「core-a」は、ファイルの名前に合わせて「files-」で始めてください" }] }
 */
export function checkDictionaries(files: readonly { name: string; source: string }[]): { keys: string[]; problems: (Finding & { file: string })[] } {
  const owner = new Map<string, string>();
  const problems: (Finding & { file: string })[] = [];
  for (const { name, source } of files) {
    const checked = checkDictionary(source);
    for (const p of checked.problems) problems.push({ file: name, ...p });
    const lines = source.split("\n");
    for (const key of checked.keys) {
      const line = lines.findIndex((l) => l.startsWith(`${key} `) || l.startsWith(`${key}=`)) + 1;
      if (!key.startsWith(`${name}-`)) problems.push({ file: name, line, message: `キー「${key}」は、ファイルの名前に合わせて「${name}-」で始めてください` });
      const other = owner.get(key);
      if (other !== undefined) problems.push({ file: name, line, message: `キー「${key}」は、${other}.ftl にもあります` });
      else owner.set(key, name);
    }
  }
  return { keys: [...owner.keys()], problems };
}

/**
 * コードが使うキーと、辞書のキーを突き合わせる。
 *
 * @param keys 辞書のキー
 * @param sources コードのファイル（パスと中身）
 * @returns unknown は、`t("…")` に書かれているが辞書に無いキー。unused は、どのコードにも文字列として書かれていない辞書のキー
 * @example
 * keyUsage(["saved", "old"], [{ file: "a.ts", source: 't("saved"); t("gone");' }])
 * // → { unknown: [{ file: "a.ts", line: 1, key: "gone" }], unused: ["old"] }
 */
export function keyUsage(
  keys: readonly string[],
  sources: readonly { file: string; source: string }[],
): { unknown: { file: string; line: number; key: string }[]; unused: string[] } {
  const known = new Set(keys);
  const used = new Set<string>();
  const unknown: { file: string; line: number; key: string }[] = [];
  for (const { file, source } of sources) {
    stripTsComments(source)
      .split("\n")
      .forEach((text, k) => {
        // キーを表に持って後から t に渡す書き方もあるので、文字列として書かれていれば使っているとみなす
        for (const m of text.matchAll(/["'`]([a-z][a-z0-9-]*)["'`]/g)) if (known.has(m[1] ?? "")) used.add(m[1] ?? "");
        for (const m of text.matchAll(/(?<![\w$.])t\(\s*["'`]([^"'`]*)["'`]/g)) {
          const key = m[1] ?? "";
          if (!known.has(key)) unknown.push({ file, line: k + 1, key });
        }
      });
  }
  return { unknown, unused: keys.filter((k) => !used.has(k)) };
}
