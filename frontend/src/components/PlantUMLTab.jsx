import React from "react";
import { Box, Button, Textarea, Spinner, Center, Text, HStack, IconButton, useToast } from "@chakra-ui/react";

const DEFAULT_PLANTUML = `@startuml
Alice -> Bob: Hello
Bob -> Alice: There
@enduml`;

const PlantUmlTab = () => {
    return (
        <Box display="flex" flexDirection="column" height="100%" overflow="hidden" bg="white">
            <Text>hello</Text>
        </Box>
    )
};

export default PlantUmlTab;