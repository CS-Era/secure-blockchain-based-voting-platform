package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract è il nostro contratto
type SmartContract struct {
	contractapi.Contract
}

// Election (Elezioni)
type Election struct {
	DocType   string         `json:"docType"`
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Proposals []string       `json:"proposals"`
	IsOpen    bool           `json:"isOpen"`
	Results   map[string]int `json:"results"` // Mappa: [NomeProposta] -> ConteggioVoti
}

// Voter (Elettore)
type Voter struct {
	DocType  string          `json:"docType"`
	VoterID  string          `json:"voterID"`  // Questo ID DEVE corrispondere all'Enrollment ID
	HasVoted map[string]bool `json:"hasVoted"` // Mappa: [ElectionID] -> true
}

// --- FUNZIONI AMMINISTRATORE ---

// CreateElection: Crea una nuova elezione.
// **SICUREZZA**: Solo un Admin può farlo.
func (s *SmartContract) CreateElection(ctx contractapi.TransactionContextInterface, id string, title string, proposalsJSON string) error {
	// **SECURITY CHECK 1: Richiede ruolo 'admin'**
	isAdmin, err := checkAttribute(ctx, "hf.Type", "admin")
	if err != nil || !isAdmin {
		return fmt.Errorf("Accesso negato: solo un 'admin' può creare elezioni. %v", err)
	}

	var proposals []string
	err = json.Unmarshal([]byte(proposalsJSON), &proposals)
	if err != nil {
		return fmt.Errorf("Errore nel parsing delle proposte JSON: %s", err)
	}

	results := make(map[string]int)
	for _, p := range proposals {
		results[p] = 0 // Inizializza risultati
	}

	election := Election{
		DocType:   "election",
		ID:        id,
		Title:     title,
		Proposals: proposals,
		IsOpen:    true,
		Results:   results,
	}

	electionJSON, _ := json.Marshal(election)
	return ctx.GetStub().PutState(id, electionJSON)
}

// RegisterVoter: Abilita un elettore al voto.
// **SICUREZZA**: Solo un Admin può farlo.
func (s *SmartContract) RegisterVoter(ctx contractapi.TransactionContextInterface, voterID string) error {
	// **SECURITY CHECK 2: Richiede ruolo 'admin'**
	isAdmin, err := checkAttribute(ctx, "hf.Type", "admin")
	if err != nil || !isAdmin {
		return fmt.Errorf("Accesso negato: solo un 'admin' può registrare elettori. %v", err)
	}

	// Controlla se l'elettore esiste già
	existing, err := ctx.GetStub().GetState(voterID)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("Elettore %s già registrato", voterID)
	}

	voter := Voter{
		DocType:  "voter",
		VoterID:  voterID,
		HasVoted: make(map[string]bool),
	}

	voterJSON, _ := json.Marshal(voter)
	return ctx.GetStub().PutState(voterID, voterJSON)
}

// CloseElection: Chiude un'elezione.
func (s *SmartContract) CloseElection(ctx contractapi.TransactionContextInterface, electionID string) error {
	// **SECURITY CHECK 3: Richiede ruolo 'admin'**
	isAdmin, err := checkAttribute(ctx, "hf.Type", "admin")
	if err != nil || !isAdmin {
		return fmt.Errorf("Accesso negato: solo un 'admin' può chiudere elezioni. %v", err)
	}

	// Recupera l'elezione
	electionJSON, err := ctx.GetStub().GetState(electionID)
	if err != nil || electionJSON == nil {
		return fmt.Errorf("Elezione non trovata: %s", electionID)
	}
	var election Election
	json.Unmarshal(electionJSON, &election)

	// Chiudi
	election.IsOpen = false

	// Salva
	electionJSONUpdate, _ := json.Marshal(election)
	return ctx.GetStub().PutState(electionID, electionJSONUpdate)
}

// --- FUNZIONI ELETTORE ---

// CastVote: Il voto dell'elettore.
// **SICUREZZA**: Prevenzione doppio voto e privacy.
func (s *SmartContract) CastVote(ctx contractapi.TransactionContextInterface, electionID string, proposalName string) error {
	// **SECURITY CHECK 4: Richiede ruolo 'voter'**
	isVoter, err := checkAttribute(ctx, "role", "voter")
	if err != nil || !isVoter {
		return fmt.Errorf("Accesso negato: solo un 'voter' può votare. %v", err)
	}

	// **SECURITY CHECK 5: L'identità è presa dal certificato, non passata come arg.**
	// Questo impedisce a un utente di votare per un altro.
	voterID, err := getVoterIDFromCertificate(ctx)
	if err != nil {
		return err
	}

	// 1. Recupera l'elettore
	voterJSON, err := ctx.GetStub().GetState(voterID)
	if err != nil || voterJSON == nil {
		return fmt.Errorf("Elettore non registrato: %s. Contattare l'amministratore.", voterID)
	}
	var voter Voter
	json.Unmarshal(voterJSON, &voter)

	// 2. Recupera l'elezione
	electionJSON, err := ctx.GetStub().GetState(electionID)
	if err != nil || electionJSON == nil {
		return fmt.Errorf("Elezione non trovata: %s", electionID)
	}
	var election Election
	json.Unmarshal(electionJSON, &election)

	// **SECURITY CHECK 6: Elezione aperta?**
	if !election.IsOpen {
		return fmt.Errorf("L'elezione '%s' è chiusa", electionID)
	}

	// **SECURITY CHECK 7: PREVENZIONE DOPPIO VOTO**
	if voter.HasVoted[electionID] {
		return fmt.Errorf("L'elettore %s ha già votato per l'elezione %s", voterID, electionID)
	}

	// 3. Registra il voto (aggiorna il conteggio)
	if _, ok := election.Results[proposalName]; !ok {
		return fmt.Errorf("Proposta non valida: %s", proposalName)
	}
	election.Results[proposalName]++

	// 4. Marca l'elettore (per prevenire doppio voto)
	voter.HasVoted[electionID] = true

	// 5. Salva entrambi gli stati (transazione atomica)
	voterJSONUpdate, _ := json.Marshal(voter)
	err = ctx.GetStub().PutState(voterID, voterJSONUpdate)
	if err != nil {
		return err
	}

	electionJSONUpdate, _ := json.Marshal(election)
	return ctx.GetStub().PutState(electionID, electionJSONUpdate)
}

// --- FUNZIONI PUBBLICHE (QUERY) ---

// GetResults: Query pubblica dei risultati
func (s *SmartContract) GetResults(ctx contractapi.TransactionContextInterface, electionID string) (*Election, error) {
	electionJSON, err := ctx.GetStub().GetState(electionID)
	if err != nil || electionJSON == nil {
		return nil, fmt.Errorf("Elezione non trovata: %s", electionID)
	}
	var election Election
	json.Unmarshal(electionJSON, &election)

	return &election, nil
}

// --- HELPERS DI SICUREZZA ---

// checkAttribute: Controlla se il client ha un attributo specifico
func checkAttribute(ctx contractapi.TransactionContextInterface, attrName string, attrValue string) (bool, error) {
	val, found, err := ctx.GetClientIdentity().GetAttributeValue(attrName)
	if err != nil {
		return false, fmt.Errorf("Errore nel recuperare l'attributo %s: %v", attrName, err)
	}
	if !found {
		// Se l'attributo non è trovato, loggalo per debug
		// log.Printf("Attributo '%s' non trovato nel certificato", attrName)
		return false, nil
	}
	return val == attrValue, nil
}

// getVoterIDFromCertificate: Recupera l'ID di iscrizione (Enrollment ID)
func getVoterIDFromCertificate(ctx contractapi.TransactionContextInterface) (string, error) {
	// Questo è il modo più pulito: usa l'attributo 'voterID'
	voterID, found, err := ctx.GetClientIdentity().GetAttributeValue("voterID")
	if err != nil {
		return "", fmt.Errorf("Errore nel leggere attributo voterID: %v", err)
	}
	if !found {
		// Se l'attributo 'voterID' non è nel certificato, blocca.
		return "", fmt.Errorf("Attributo 'voterID' non trovato nel certificato. L'identità non è valida per il voto.")
	}
	return voterID, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Errore nella creazione del chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Errore nell'avvio del chaincode: %v", err)
	}
}
