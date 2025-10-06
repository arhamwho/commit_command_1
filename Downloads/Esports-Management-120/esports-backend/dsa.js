// ====================================================================================
// DSA.JS - DATA STRUCTURES & ALGORITHMS FOR ESPORTS MANAGEMENT SYSTEM
// ====================================================================================
// This file contains three main data structures used in the esports platform:
// 1. MinHeap - For efficient leaderboard/ranking management
// 2. Trie - For fast player/team name searching (autocomplete functionality)
// 3. Graph - For tournament scheduling and match path optimization
// ====================================================================================

// ====================================================================================
// 1. MINHEAP CLASS - EFFICIENT LEADERBOARD MANAGEMENT
// ====================================================================================
// Purpose: Maintains a heap data structure where the smallest element is always at the root
// Use Case: Leaderboards, rankings, priority queues for tournament seeding
// Time Complexity: Insert O(log n), Extract Min O(log n), Peek O(1)
// Space Complexity: O(n)

class MinHeap {
    constructor() {
        // Array to store heap elements
        // Index 0 = root (minimum element)
        // Parent of node i = Math.floor((i-1)/2)
        // Left child of node i = 2*i + 1
        // Right child of node i = 2*i + 2
        this.heap = [];
    }

    // Helper method to get parent index of a given node
    // Formula: parent(i) = Math.floor((i-1)/2)
    getParentIndex(i) { 
        return Math.floor((i - 1) / 2); 
    }

    // Helper method to get left child index of a given node
    // Formula: leftChild(i) = 2*i + 1
    getLeftChildIndex(i) { 
        return 2 * i + 1; 
    }

    // Helper method to get right child index of a given node
    // Formula: rightChild(i) = 2*i + 2
    getRightChildIndex(i) { 
        return 2 * i + 2; 
    }

    // Insert a new value into the heap
    // Steps: 1) Add to end of array, 2) Bubble up to maintain heap property
    insert(value) {
        this.heap.push(value);           // Add new element at the end
        this.heapifyUp();                // Restore heap property by moving up
    }

    // Restore heap property by moving element up the tree
    // Compares with parent and swaps if parent is larger (min-heap property)
    heapifyUp() {
        let i = this.heap.length - 1;    // Start from the last element (newly inserted)
        
        // Continue until we reach root or parent is smaller
        while (i > 0 && this.heap[this.getParentIndex(i)] > this.heap[i]) {
            // Swap current element with its parent
            [this.heap[this.getParentIndex(i)], this.heap[i]] = [this.heap[i], this.heap[this.getParentIndex(i)]];
            i = this.getParentIndex(i);  // Move to parent position
        }
    }

    // Extract and return the minimum element (root)
    // Steps: 1) Save root, 2) Move last element to root, 3) Heapify down
    extractMin() {
        if (this.heap.length === 0) return null;    // Empty heap
        if (this.heap.length === 1) return this.heap.pop(); // Single element

        const root = this.heap[0];       // Save the minimum element
        this.heap[0] = this.heap.pop();  // Move last element to root
        this.heapifyDown(0);            // Restore heap property by moving down
        return root;                     // Return the minimum element
    }

    // Restore heap property by moving element down the tree
    // Compares with children and swaps with smallest child
    heapifyDown(i) {
        let smallest = i;                           // Assume current node is smallest
        const left = this.getLeftChildIndex(i);     // Get left child index
        const right = this.getRightChildIndex(i);   // Get right child index

        // Check if left child exists and is smaller than current smallest
        if (left < this.heap.length && this.heap[left] < this.heap[smallest]) {
            smallest = left;
        }
        
        // Check if right child exists and is smaller than current smallest
        if (right < this.heap.length && this.heap[right] < this.heap[smallest]) {
            smallest = right;
        }
        
        // If smallest changed, swap and continue heapifying down
        if (smallest !== i) {
            [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
            this.heapifyDown(smallest);  // Recursively heapify the affected subtree
        }
    }
}

// ====================================================================================
// 2. TRIE CLASS - FAST STRING SEARCHING FOR PLAYER/TEAM NAMES
// ====================================================================================
// Purpose: Efficient prefix-based searching for autocomplete functionality
// Use Case: Player search, team search, tournament name suggestions
// Time Complexity: Insert O(m), Search O(m), where m = length of string
// Space Complexity: O(ALPHABET_SIZE * N * M), where N = number of strings, M = average length

// Individual node in the trie tree
class TrieNode {
    constructor() {
        this.children = {};              // Object to store child nodes (character -> TrieNode)
        this.isEndOfWord = false;        // Flag to mark end of a complete word
    }
}

// Main trie data structure for string operations
class Trie {
    constructor() {
        this.root = new TrieNode();     // Create root node (empty string)
    }

    // Insert a word into the trie
    // Traverses the tree, creating new nodes as needed
    insert(word) {
        let node = this.root;           // Start from root
        
        // Traverse each character in the word
        for (let char of word) {
            // If character doesn't exist as child, create new node
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char]; // Move to child node
        }
        node.isEndOfWord = true;        // Mark end of word
    }

    // Search for all words that start with given prefix
    // Returns array of all matching words
    search(prefix) {
        let node = this.root;           // Start from root
        
        // Navigate to the prefix node
        for (let char of prefix) {
            if (!node.children[char]) {
                return [];              // Prefix doesn't exist, return empty array
            }
            node = node.children[char]; // Move to child node
        }
        
        // Get all words starting from this node
        return this.getWords(node, prefix);
    }

    // Recursively collect all words from a given node
    // Uses depth-first search to traverse all possible paths
    getWords(node, prefix) {
        let results = [];
        
        // If current node marks end of word, add prefix to results
        if (node.isEndOfWord) {
            results.push(prefix);
        }
        
        // Recursively explore all child nodes
        for (let char in node.children) {
            // Concatenate current character to prefix and search deeper
            results = results.concat(this.getWords(node.children[char], prefix + char));
        }
        
        return results;
    }
}

// ====================================================================================
// 3. GRAPH CLASS - TOURNAMENT SCHEDULING AND MATCH PATH OPTIMIZATION
// ====================================================================================
// Purpose: Represent relationships between teams/players for tournament scheduling
// Use Case: Tournament brackets, match scheduling, finding optimal paths
// Time Complexity: Add Vertex O(1), Add Edge O(1), BFS O(V + E)
// Space Complexity: O(V + E), where V = vertices, E = edges

class Graph {
    constructor() {
        // Adjacency list representation using Map
        // Key: vertex (team/player name), Value: array of connected vertices
        this.adjList = new Map();
    }

    // Add a new vertex (team/player) to the graph
    addVertex(v) {
        // Only add if vertex doesn't already exist
        if (!this.adjList.has(v)) {
            this.adjList.set(v, []);    // Initialize with empty adjacency list
        }
    }

    // Add an edge between two vertices (create a connection)
    // Creates undirected edge: if A connects to B, then B also connects to A
    addEdge(v, w) {
        this.adjList.get(v).push(w);    // Add w to v's adjacency list
        this.adjList.get(w).push(v);    // Add v to w's adjacency list (undirected)
    }

    // Breadth-First Search algorithm
    // Purpose: Find shortest path, explore all reachable nodes from starting point
    // Use Case: Tournament bracket traversal, finding all teams a player has faced
    bfs(startingNode) {
        let visited = new Set();        // Track visited nodes to avoid cycles
        let queue = [startingNode];     // Queue for BFS traversal
        let result = [];                // Store traversal order

        visited.add(startingNode);      // Mark starting node as visited

        // Process queue until empty
        while (queue.length) {
            let node = queue.shift();   // Remove and get first element from queue
            result.push(node);          // Add to result

            // Explore all neighbors of current node
            for (let neighbor of this.adjList.get(node)) {
                // If neighbor hasn't been visited, add to queue
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);  // Mark as visited
                    queue.push(neighbor);   // Add to queue for future processing
                }
            }
        }
        return result;                 // Return nodes in BFS order
    }
}

// ====================================================================================
// EXPORT STATEMENT - MAKE CLASSES AVAILABLE TO OTHER MODULES
// ====================================================================================
module.exports = { MinHeap, Trie, Graph };
  