#!/bin/bash

# Test runner script for frontend blob components
# Uruchamia wszystkie testy frontendowe dla komponentów blob storage

echo "🧪 Uruchamianie testów frontendowych dla komponentów Blob..."
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run tests with proper formatting
run_test_suite() {
    local test_file=$1
    local test_name=$2
    
    echo -e "\n${BLUE}📋 Testowanie: ${test_name}${NC}"
    echo "----------------------------------------"
    
    if npm run test -- "$test_file" --reporter=verbose; then
        echo -e "${GREEN}✅ $test_name - PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name - FAIL${NC}"
        return 1
    fi
}

# Counter for results
total_suites=0
passed_suites=0

# Test suites
echo -e "${YELLOW}🔧 Konfigurowanie środowiska testowego...${NC}"

# Run individual test suites
test_suites=(
    "src/test/services/blobsService.test.ts:Serwis blobsService"
    "src/test/components/blobs/ContainerSelector.test.tsx:Komponent ContainerSelector"
    "src/test/components/blobs/FileList.test.tsx:Komponent FileList"
    "src/test/components/blobs/FilePreview.test.tsx:Komponent FilePreview"
    "src/test/pages/Blobs.test.tsx:Strona Blobs (Integracja)"
)

for suite in "${test_suites[@]}"; do
    IFS=':' read -r test_file test_name <<< "$suite"
    total_suites=$((total_suites + 1))
    
    if run_test_suite "$test_file" "$test_name"; then
        passed_suites=$((passed_suites + 1))
    fi
done

# Run all blob tests together
echo -e "\n${BLUE}🚀 Uruchamianie wszystkich testów blob razem...${NC}"
echo "============================================"

if npm run test -- "src/test/**/*blob*" --coverage; then
    echo -e "${GREEN}✅ Wszystkie testy blob - PASS${NC}"
    all_tests_passed=true
else
    echo -e "${RED}❌ Niektóre testy blob - FAIL${NC}"
    all_tests_passed=false
fi

# Summary
echo -e "\n${YELLOW}📊 PODSUMOWANIE TESTÓW FRONTENDOWYCH${NC}"
echo "===================================="
echo -e "Zestawy testów: ${total_suites}"
echo -e "Pomyślne: ${GREEN}${passed_suites}${NC}"
echo -e "Nieudane: ${RED}$((total_suites - passed_suites))${NC}"

if [ $passed_suites -eq $total_suites ] && [ "$all_tests_passed" = true ]; then
    echo -e "\n${GREEN}🎉 WSZYSTKIE TESTY FRONTENDOWE PRZESZŁY POMYŚLNIE!${NC}"
    echo -e "${GREEN}Komponenty blob storage są w pełni przetestowane i gotowe do użycia.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  NIEKTÓRE TESTY FRONTENDOWE NIE PRZESZŁY${NC}"
    echo -e "${RED}Sprawdź logi powyżej dla szczegółów błędów.${NC}"
    exit 1
fi
