> **A Blockchain-based E-Voting Platform for Secure and Verifiable Elections.**

This is a modern electronic voting system designed to bring trust, transparency, and anonymity to university elections. By combining the speed of traditional databases with the immutability of **Hyperledger Fabric**, it ensures that every vote is counted correctly and no vote can be modified.

---

### 🔑 Key Features

* **🔒 Integrity:** Once a vote is cast, it is anchored to the Blockchain. No one can alter the results without breaking the cryptographic seal.
* **👤 Total Anonymity:** The system uses a dual-storage architecture. The identity of the voter and the content of the vote are stored separately and cannot be linked back to each other.
* **✅ Verifiability:** After voting, the user receives a **Vote Hash** (receipt). Using this receipt, they can mathematically prove that their vote is included in the final count via Merkle Proof.

---

## 🛠️ Technology Stack

* **Frontend:** React, Tailwind CSS, Vite
* **Backend:** Node.js, Express
* **Blockchain:** Hyperledger Fabric (Go Chaincode)
* **Database:** PostgreSQL


---

## 📝 Scope

This project is part of a Master's Exam in Computer Science, Cybersecurity curriculum.
