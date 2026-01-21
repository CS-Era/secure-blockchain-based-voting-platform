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

// Struttura di una elezione
type Election struct {
	ID           string `json:"id"`
	ElectionHash string `json:"election_hash"`
	MerkleRoot   string `json:"merkle_root"`
	ResultsHash  string `json:"results_hash"`
}

// Struttura di un voto
type Vote struct {
	ElectionID  string `json:"election_id"`
	VoterIDHash string `json:"voter_id_hash"`
	VoteHash    string `json:"vote_hash"`
}

// Creazione di una elezione
func (c *ElectionChaincode) CreateElection(ctx contractapi.TransactionContextInterface, electionID string, electionHash string) error {
	exists, err := ctx.GetStub().GetState(electionID)
	if err != nil {
		return fmt.Errorf("errore controllando esistenza elezione: %v", err)
	}
	if exists != nil {
		return fmt.Errorf("elezione %s già esistente", electionID)
	}

	election := Election{
		ID:           electionID,
		ElectionHash: electionHash,
	}

	electionBytes, _ := json.Marshal(election)
	return ctx.GetStub().PutState(electionID, electionBytes)
}

// Votazione
func (c *ElectionChaincode) CastVote(ctx contractapi.TransactionContextInterface, electionID string, voterIDHash string, voteHash string) error {

	// 1. Verifica esistenza elezione
	electionBytes, err := ctx.GetStub().GetState(electionID)
	if err != nil || electionBytes == nil {
		return fmt.Errorf("elezione non trovata: %v", err)
	}

	// 2. Check anti doppio voto con chiave unica
	voterCheckKey := fmt.Sprintf("check-%s-%s", electionID, voterIDHash)
	alreadyVoted, err := ctx.GetStub().GetState(voterCheckKey)
	if err != nil {
		return fmt.Errorf("errore lettura stato elettore: %v", err)
	}
	if alreadyVoted != nil {
		return fmt.Errorf("questo elettore ha già votato per questa elezione")
	}

	// 3. Creazione oggetto Voto
	vote := Vote{
		ElectionID:  electionID,
		VoterIDHash: voterIDHash,
		VoteHash:    voteHash,
	}

	// 4. Salvataggio del Voto
	voteKey := fmt.Sprintf("vote-%s-%s", electionID, voterIDHash)
	voteBytes, _ := json.Marshal(vote)
	err = ctx.GetStub().PutState(voteKey, voteBytes)
	if err != nil {
		return fmt.Errorf("errore salvataggio voto: %v", err)
	}

	// Salviamo un flag leggero "true" nella chiave di controllo
	return ctx.GetStub().PutState(voterCheckKey, []byte("true"))
}

// Chiusura elezione
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
