document.addEventListener("DOMContentLoaded", () => {
  class Spreadsheet {
    constructor(containerId, rowCount, colCount) {
      this.tableBody = document.querySelector(`#${containerId} tbody`);
      this.rowCount = rowCount;
      this.colCount = colCount;
      this.isSelecting = false;
      this.selectionStart = null;
      this.selectionEnd = null;
      this.copiedData = [];
      this.sortRules = [];
      this.filters = {}; // { colIndex: [value1, value2], ... }

      this.createTable();
      this.setupSelection();
      this.setupClipboard();
      this.setupSorting();
      this.setupFiltering(); // 구현 추가
    }

    generateRandomValue = () => Math.floor(Math.random() * 1000);

    createTable = () => {
      for (let i = 0; i < this.rowCount; i++) {
        const row = document.createElement("tr");
        row.dataset.index = i; // 초기 순서 기억
        for (let j = 0; j < this.colCount; j++) {
          const cell = document.createElement("td");
          cell.contentEditable = "true";
          cell.textContent = this.generateRandomValue();
          cell.addEventListener("click", () => this.clearPasted());
          row.appendChild(cell);
        }
        this.tableBody.appendChild(row);
      }
    };
    
    // --- 빠져있던 헬퍼 함수들 ---
    clearHighlight = () => document.querySelectorAll(".selected").forEach((c) => c.classList.remove("selected"));
    clearCopied = () => document.querySelectorAll(".copied").forEach((c) => c.classList.remove("copied"));
    clearPasted = () => document.querySelectorAll(".pasted").forEach((c) => c.classList.remove("pasted"));


    setupSelection = () => {
      this.tableBody.addEventListener("mousedown", (event) => {
        if (event.target.tagName !== "TD") return;
        this.isSelecting = true;
        this.selectionStart = event.target;
        this.clearHighlight();
        event.target.classList.add("selected");
      });

      this.tableBody.addEventListener("mouseover", (event) => {
        if (!this.isSelecting || event.target.tagName !== "TD") return;
        this.clearHighlight();
        this.selectionEnd = event.target;
        const startRow = Math.min(this.selectionStart.parentNode.rowIndex, this.selectionEnd.parentNode.rowIndex);
        const endRow = Math.max(this.selectionStart.parentNode.rowIndex, this.selectionEnd.parentNode.rowIndex);
        const startCol = Math.min(this.selectionStart.cellIndex, this.selectionEnd.cellIndex);
        const endCol = Math.max(this.selectionStart.cellIndex, this.selectionEnd.cellIndex);
        
        for (let i = startRow; i <= endRow; i++) {
          // thead를 포함하므로 -1
          const row = this.tableBody.parentNode.rows[i];
          if(row.parentNode.tagName === 'TBODY') {
             for (let j = startCol; j <= endCol; j++) {
                row.cells[j].classList.add("selected");
             }
          }
        }
      });

      document.addEventListener("mouseup", () => {
        this.isSelecting = false;
      });
    };

    setupClipboard = () => {
      document.addEventListener("copy", (event) => {
        const selectedCells = document.querySelectorAll(".selected");
        if (selectedCells.length === 0) return;
        event.preventDefault();
        this.clearCopied();
        this.copiedData = [];

        const selectionRect = {
            startRow: Infinity, endRow: -1,
            startCol: Infinity, endCol: -1
        };

        selectedCells.forEach(cell => {
            selectionRect.startRow = Math.min(selectionRect.startRow, cell.parentNode.rowIndex);
            selectionRect.endRow = Math.max(selectionRect.endRow, cell.parentNode.rowIndex);
            selectionRect.startCol = Math.min(selectionRect.startCol, cell.cellIndex);
            selectionRect.endCol = Math.max(selectionRect.endCol, cell.cellIndex);
        });

        for(let i = selectionRect.startRow; i <= selectionRect.endRow; i++) {
            const rowValues = [];
            for(let j = selectionRect.startCol; j <= selectionRect.endCol; j++) {
                const cell = this.tableBody.parentNode.rows[i].cells[j];
                rowValues.push(cell.textContent);
                cell.classList.add("copied");
            }
            this.copiedData.push(rowValues);
        }
        
        event.clipboardData.setData(
          "text/plain",
          this.copiedData.map((row) => row.join("\t")).join("\n")
        );
      });

      document.addEventListener("paste", (event) => {
        event.preventDefault();
        const clipboardText = event.clipboardData.getData("text/plain");
        if (!clipboardText) return;
        
        const rowsData = clipboardText.split("\n").map((row) => row.split("\t"));
        const selectedCell = document.querySelector(".selected");
        if (!selectedCell) return;

        const startRow = selectedCell.parentNode.rowIndex -1; // tbody 기준
        const startCol = selectedCell.cellIndex;

        rowsData.forEach((rowData, i) => {
          rowData.forEach((cellData, j) => {
            const rowIndex = startRow + i;
            const colIndex = startCol + j;
            if (
              rowIndex < this.tableBody.rows.length &&
              colIndex < this.tableBody.rows[0].cells.length
            ) {
              const targetCell = this.tableBody.rows[rowIndex].cells[colIndex];
              targetCell.textContent = cellData;
              targetCell.classList.add("pasted");
            }
          });
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Delete" || event.key === "Backspace") {
          document.querySelectorAll(".selected").forEach((cell) => (cell.textContent = ""));
          event.preventDefault();
        }
      });
    };

    setupSorting = () => {
      document.querySelectorAll(".sort-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.clearHighlight(); this.clearCopied(); this.clearPasted();
          
          const colIndex = parseInt(btn.getAttribute("data-col-index"));
          let sortState = btn.getAttribute("data-sort") || "none";
          
          if (sortState === "none") sortState = "asc";
          else if (sortState === "asc") sortState = "desc";
          else sortState = "none";
          
          document.querySelectorAll(".sort-btn").forEach(b => b.setAttribute("data-sort", "none"));
          btn.setAttribute("data-sort", sortState);

          this.sortRules = []; // 단일 정렬로 변경
          if (sortState !== 'none') {
            this.sortRules.push({ colIndex, sort: sortState });
          }

          const rowsArray = Array.from(this.tableBody.rows);

          rowsArray.sort((a, b) => {
            if (this.sortRules.length > 0) {
              const { colIndex, sort } = this.sortRules[0];
              const cellA = a.cells[colIndex].textContent.trim();
              const cellB = b.cells[colIndex].textContent.trim();
              const numA = parseFloat(cellA);
              const numB = parseFloat(cellB);
              
              let comp = isNaN(numA) || isNaN(numB)
                ? cellA.localeCompare(cellB)
                : numA - numB;
              
              if (comp !== 0) return sort === "asc" ? comp : -comp;
            }
            return parseInt(a.dataset.index) - parseInt(b.dataset.index);
          });
          
          rowsArray.forEach((row) => this.tableBody.appendChild(row));
        });
      });
    };
    
    // --- 새롭게 구현된 필터링 기능 ---
    setupFiltering = () => {
        const filterModal = document.getElementById("filterModal");
        const filterOptions = document.getElementById("filterOptions");
        const applyFilterBtn = document.getElementById("applyFilter");
        const clearFilterBtn = document.getElementById("clearFilter");
        const closeFilterBtn = document.getElementById("closeFilter");
        const filterSearch = document.getElementById("filterSearch");
        let currentColIndex = -1;

        document.querySelectorAll(".filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                currentColIndex = parseInt(e.target.dataset.colIndex);
                const uniqueValues = [...new Set(Array.from(this.tableBody.rows).map(row => row.cells[currentColIndex].textContent))];
                
                filterOptions.innerHTML = '';
                uniqueValues.sort().forEach(value => {
                    const li = document.createElement('li');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = value;
                    checkbox.id = `filter-val-${value}`;
                    // 현재 필터 상태 반영
                    if (this.filters[currentColIndex] && this.filters[currentColIndex].includes(value)) {
                        checkbox.checked = true;
                    } else if (!this.filters[currentColIndex]) {
                         checkbox.checked = true; // 필터 없으면 전체 선택
                    }
                    
                    const label = document.createElement('label');
                    label.htmlFor = `filter-val-${value}`;
                    label.textContent = value;
                    
                    li.appendChild(checkbox);
                    li.appendChild(label);
                    filterOptions.appendChild(li);
                });

                const rect = e.target.getBoundingClientRect();
                filterModal.style.left = `${rect.left}px`;
                filterModal.style.top = `${rect.bottom + window.scrollY}px`;
                filterModal.style.display = 'block';
            });
        });

        applyFilterBtn.addEventListener("click", () => {
            const checkedValues = Array.from(filterOptions.querySelectorAll("input:checked")).map(input => input.value);
            this.filters[currentColIndex] = checkedValues;
            this.applyFilters();
            filterModal.style.display = 'none';
        });

        clearFilterBtn.addEventListener("click", () => {
            delete this.filters[currentColIndex];
            this.applyFilters();
            filterModal.style.display = 'none';
        });

        closeFilterBtn.addEventListener('click', () => filterModal.style.display = 'none');
        
        filterSearch.addEventListener('keyup', () => {
            const searchTerm = filterSearch.value.toLowerCase();
            filterOptions.querySelectorAll('li').forEach(li => {
                const label = li.querySelector('label').textContent.toLowerCase();
                li.style.display = label.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    applyFilters = () => {
        Array.from(this.tableBody.rows).forEach(row => {
            let isVisible = true;
            for (const colIndex in this.filters) {
                const cellValue = row.cells[colIndex].textContent;
                if (!this.filters[colIndex].includes(cellValue)) {
                    isVisible = false;
                    break;
                }
            }
            row.style.display = isVisible ? '' : 'none';
        });
    }
  }

  new Spreadsheet("excelTable", 32, 11);
});