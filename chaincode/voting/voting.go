package main

import (
    "encoding/json"
    "fmt"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ElectionChaincode struttura principale
type ElectionChaincode struct {
    contractapi.Contract
}

// Election rappresenta un’elezione
type Election struct {
    ID          string   `json:"id"`
    Title       string   `json:"title"`
    Description string   `json:"description"`
    Candidates  []string `json:"candidates"`
    StartDate   string   `json:"start_date"`
    EndDate     string   `json:"end_date"`
    Closed      bool     `json:"closed"`
    MerkleRoot  string   `json:"merkle_root"`
    ResultsHash string   `json:"results_hash"`
}

// Vote rappresenta un voto hashato
type Vote struct {
    ElectionID string `json:"election_id"`
    VoteHash   string `json:"vote_hash"`
}

// ---------------------------
// CREATE ELECTION
// ---------------------------
func (c *ElectionChaincode) CreateElection(ctx contractapi.TransactionContextInterface, electionID string, title string, description string, candidatesJSON string, startDate string, endDate string) error {

    exists, err := ctx.GetStub().GetState(electionID)
    if err != nil {
        return fmt.Errorf("errore controllando esistenza elezione: %v", err)
    }
    if exists != nil {
        return fmt.Errorf("elezione %s già esistente", electionID)
    }

    var candidates []string
    err = json.Unmarshal([]byte(candidatesJSON), &candidates)
    if err != nil {
        return fmt.Errorf("candidati non validi: %v", err)
    }

    election := Election{
        ID:          electionID,
        Title:       title,
        Description: description,
        Candidates:  candidates,
        StartDate:   startDate,
        EndDate:     endDate,
        Closed:      false,
    }

    electionBytes, _ := json.Marshal(election)
    return ctx.GetStub().PutState(electionID, electionBytes)
}

// ---------------------------
// CAST VOTE
// ---------------------------
func (c *ElectionChaincode) CastVote(ctx contractapi.TransactionContextInterface, electionID string, voteHash string) error {

    electionBytes, err := ctx.GetStub().GetState(electionID)
    if err != nil || electionBytes == nil {
        return fmt.Errorf("elezione non trovata: %v", err)
    }

    vote := Vote{
        ElectionID: electionID,
        VoteHash:   voteHash,
    }

    // La chiave per ogni voto può essere "vote-{electionID}-{hash}"
    voteKey := fmt.Sprintf("vote-%s-%s", electionID, voteHash)
    voteBytes, _ := json.Marshal(vote)
    return ctx.GetStub().PutState(voteKey, voteBytes)
}

// ---------------------------
// CLOSE ELECTION
// ---------------------------
func (c *ElectionChaincode) CloseElection(ctx contractapi.TransactionContextInterface, electionID string, merkleRoot string, resultsHash string) error {

    electionBytes, err := ctx.GetStub().GetState(electionID)
    if err != nil || electionBytes == nil {
        return fmt.Errorf("elezione non trovata: %v", err)
    }

    var election Election
    err = json.Unmarshal(electionBytes, &election)
    if err != nil {
        return fmt.Errorf("errore decodificando elezione: %v", err)
    }

    election.Closed = true
    election.MerkleRoot = merkleRoot
    election.ResultsHash = resultsHash

    updatedBytes, _ := json.Marshal(election)
    return ctx.GetStub().PutState(electionID, updatedBytes)
}

// ---------------------------
// QUERY ELECTION
// ---------------------------
func (c *ElectionChaincode) QueryElection(ctx contractapi.TransactionContextInterface, electionID string) (*Election, error) {
    electionBytes, err := ctx.GetStub().GetState(electionID)
    if err != nil || electionBytes == nil {
        return nil, fmt.Errorf("elezione non trovata: %v", err)
    }

    var election Election
    err = json.Unmarshal(electionBytes, &election)
    if err != nil {
        return nil, fmt.Errorf("errore decodificando elezione: %v", err)
    }

    return &election, nil
}

// ---------------------------
// MAIN
// ---------------------------
func main() {
    chaincode, err := contractapi.NewChaincode(new(ElectionChaincode))
    if err != nil {
        fmt.Printf("Errore creando chaincode: %v\n", err)
        return
    }

    if err := chaincode.Start(); err != nil {
        fmt.Printf("Errore avviando chaincode: %v\n", err)
    }
}
