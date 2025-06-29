export function setupAccordion() {
  // ページ内にある全てのアコーディオンのタイトル部分（.title）を取得します
  const titles = document.querySelectorAll(".accordion .title");

  titles.forEach(title => {
    // --- ★修正点：複数回実行されても安全にするためのガード処理を追加 ---
    // このタイトルに既に設定済みの目印（dataset）があれば、二重にイベントを設定しないように処理を中断します
    if (title.dataset.accordionInitialized) {
      return;
    }
    // このタイトルにイベントを設定した、という目印を付けます
    title.dataset.accordionInitialized = 'true';


    // それぞれのタイトルにクリックイベントを設定します
    title.addEventListener("click", (event) => {
      
      // クリックされた場所がトグルスイッチ（.parent-toggle-switch）の中だった場合、
      // アコーディオンを開閉させずに、この後の処理を中断します
      if (event.target.closest('.parent-toggle-switch')) {
        return;
      }
      
      // クリックされたタイトルの親要素である .accordion-item を探します
      const item = title.closest('.accordion-item');
      if (!item) return; // 見つからなければ処理を終了

      // accordion-item の中から、開閉させたいコンテンツ部分（.content）を探します
      const content = item.querySelector('.content');
      if (!content) return; // 見つからなければ処理を終了

      // --- 動作の切り替え ---

      // .accordion-item に "open" クラスを付け外しします。
      // これにより、CSS側で矢印アイコンの向きなどを制御できます。
      item.classList.toggle("open");
      
      // コンテンツのmaxHeightスタイルが設定されているか（=開いているか）どうかで処理を分岐します
      if (content.style.maxHeight) {
        // スタイルが設定されている（開いている）場合 -> 閉じる処理
        // max-heightをnullに戻すことで、CSSのtransitionが適用され、滑らかに閉じます。
        content.style.maxHeight = null;
      } else {
        // スタイルが設定されていない（閉じている）場合 -> 開く処理
        // コンテンツ自身の本来の高さ（scrollHeight）をmax-heightに設定し、滑らかに展開させます。
        content.style.maxHeight = content.scrollHeight + "px";
      }
    });
  });
}
