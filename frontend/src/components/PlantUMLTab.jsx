import React from "react";
import { Box, Button, Textarea, Spinner, Center, Text, HStack, IconButton, useToast } from "@chakra-ui/react";

const DEFAULT_PLANTUML = `@startuml
Alice -> Bob: Hello
Bob -> Alice: There
@enduml`;

const PlantUmlTab = () => {
    return (
        <Box display="flex" flexDirection="column" height="100%" overflow="hidden" bg="white">
            {/* content area */}
            <Box flex="1" minHeight={0} overflow="auto" position="relative">
                {/* plantuml svg renderer */}
                <Box width="100%" height="100%" position="relative">
                </Box>
            </Box>
        </Box>
    )
};

export default PlantUmlTab;