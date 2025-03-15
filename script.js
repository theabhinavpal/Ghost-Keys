// Set worker path for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");
const loadingIndicator = document.getElementById("loadingIndicator");
const fileInfo = document.getElementById("fileInfo");
const pauseBtn = document.getElementById("pauseBtn");
const clearBtn = document.getElementById("clearBtn");

// Typing state variables
let isPaused = false;
let isTyping = false;
let timerId = null;
let currentParagraphs = [];
let currentIndex = 0;
let currentCharIndex = 0;
let currentElement = null;

// Event Listeners
fileInput.addEventListener("change", handleFileUpload);
pauseBtn.addEventListener("click", togglePause);
clearBtn.addEventListener("click", clearOutput);

/**
 * Toggle pause/resume of typing animation
 */
function togglePause() {
  if (!isTyping) return;
  
  isPaused = !isPaused;
  
  if (isPaused) {
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("paused");
    // If there's a scheduled typing operation, clear it
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  } else {
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
    // Resume typing from where we left off
    if (currentElement) {
      continueTyping();
    }
  }
}

/**
 * Clear the output area
 */
function clearOutput() {
  // Stop any ongoing typing
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  
  // Reset typing state
  isTyping = false;
  isPaused = false;
  currentParagraphs = [];
  currentIndex = 0;
  currentCharIndex = 0;
  currentElement = null;
  
  // Clear the output
  output.innerHTML = "";
  
  // Reset the pause button
  pauseBtn.textContent = "Pause";
  pauseBtn.classList.remove("paused");
  pauseBtn.disabled = true;
  
  // Clear file info
  fileInfo.textContent = "";
  
  // Reset file input to allow selecting the same file again
  fileInput.value = "";
}

/**
 * Handles file upload and processes different file types
 */
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Clear previous content first
  clearOutput();
  
  // Show file info
  fileInfo.textContent = `File: ${file.name}`;
  
  // Show loading indicator
  loadingIndicator.style.display = "block";

  const fileType = file.type;

  if (fileType === "text/plain") {
    // Handle .txt files
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      processText(text);
    };
    reader.onerror = function() {
      showError("Error reading file.");
    };
    reader.readAsText(file);
  } else if (fileType === "application/pdf") {
    // Handle .pdf files
    const reader = new FileReader();
    reader.onload = function(e) {
      const typedArray = new Uint8Array(e.target.result);
      parsePDF(typedArray);
    };
    reader.onerror = function() {
      showError("Error reading PDF file.");
    };
    reader.readAsArrayBuffer(file);
  } else {
    loadingIndicator.style.display = "none";
    alert("Unsupported file type. Please upload a .txt or .pdf file.");
  }
}

/**
 * Process text content and display with typing effect
 */
function processText(text) {
  // Hide loading indicator
  loadingIndicator.style.display = "none";
  
  // Split text into paragraphs, preserving the original formatting
  currentParagraphs = text.split("\n");
  
  // Start the typing process
  isTyping = true;
  pauseBtn.disabled = false;
  startTyping();
}

/**
 * Start the typing process for the current paragraphs
 */
function startTyping() {
  currentIndex = 0;
  typeParagraph();
}

/**
 * Display content as paragraphs with typing effect
 */
function typeParagraph() {
  if (currentIndex < currentParagraphs.length) {
    const paragraph = document.createElement("p");
    output.appendChild(paragraph);
    
    currentElement = paragraph;
    currentCharIndex = 0;
    
    // Type the paragraph content
    typeCharacter();
  } else {
    // All paragraphs have been typed
    isTyping = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("paused");
  }
}

/**
 * Type a single character of the current paragraph
 */
function typeCharacter() {
  if (isPaused) return;
  
  const currentText = currentParagraphs[currentIndex];
  
  if (currentCharIndex < currentText.length) {
    currentElement.textContent = currentText.substring(0, currentCharIndex + 1);
    currentCharIndex++;
    
    // Schedule the next character
    timerId = setTimeout(typeCharacter, 30);
  } else {
    // Finished typing this paragraph
    timerId = null;
    currentIndex++;
    
    // Schedule the next paragraph
    timerId = setTimeout(typeParagraph, 50);
  }
}

/**
 * Continue typing from where we left off
 */
function continueTyping() {
  if (currentIndex < currentParagraphs.length) {
    if (currentCharIndex < currentParagraphs[currentIndex].length) {
      // Continue typing the current paragraph
      typeCharacter();
    } else {
      // Move to the next paragraph
      currentIndex++;
      typeParagraph();
    }
  }
}

/**
 * Parse PDF content
 */
function parsePDF(pdfData) {
  const loadingTask = pdfjsLib.getDocument(pdfData);
  
  loadingTask.promise.then(function(pdf) {
    let allTextPromises = [];
    
    // Get text content from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const pagePromise = pdf.getPage(i).then(function(page) {
        return page.getTextContent();
      }).then(function(textContent) {
        // Extract text while preserving line breaks
        let lastY;
        let text = "";
        
        textContent.items.forEach(function(item, index) {
          // Check if y-position changed significantly - indicates new line
          if (lastY && Math.abs(lastY - item.transform[5]) > 5) {
            text += "\n";
          } else if (index > 0) {
            // Add space between words
            text += " ";
          }
          
          text += item.str;
          lastY = item.transform[5];
        });
        
        return text;
      });
      
      allTextPromises.push(pagePromise);
    }
    
    // Combine all pages and display
    Promise.all(allTextPromises).then(function(texts) {
      loadingIndicator.style.display = "none";
      
      // Join page texts and split into paragraphs
      const fullText = texts.join("\n\n");
      processText(fullText);
    });
  }).catch(function(error) {
    console.error("Error loading PDF:", error);
    showError("Failed to load PDF. Please ensure the file is not corrupted.");
  });
}

/**
 * Show error message
 */
function showError(message) {
  loadingIndicator.style.display = "none";
  output.innerHTML = `<p style="color: red;">${message}</p>`;
  pauseBtn.disabled = true;
}