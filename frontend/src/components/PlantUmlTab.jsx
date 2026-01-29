import { useState, useEffect } from "react";
import { Box, Textarea, Spinner, Center, Text, HStack, IconButton, useToast } from "@chakra-ui/react";
import { EditIcon, ViewIcon } from "@chakra-ui/icons";
import { apiUrl } from "../../api/index.jsx";

const DEFAULT_PLANTUML = `@startuml
start
:Hello world;
stop
@enduml`;

const PlantUmlTab = () => {
  const [plantUmlCode, setPlantUmlCode] = useState(DEFAULT_PLANTUML);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [diagramSvg, setDiagramSvg] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  // load from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('plantuml_code');
    if (stored) {
      setPlantUmlCode(stored);
    }
  }, []);

  // save to sessionStorage whenever code changes
  useEffect(() => {
    if (plantUmlCode) {
      sessionStorage.setItem('plantuml_code', plantUmlCode);
    }
  }, [plantUmlCode]);

  // render diagram when code changes (only in view mode)
  useEffect(() => {
    if (!isEditMode && plantUmlCode) {
      renderDiagram(plantUmlCode);
    }
  }, [plantUmlCode, isEditMode]);

  const renderDiagram = async (code) => {
    if (!code || !code.trim()) {
      setDiagramSvg(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/plantuml/render"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantuml: code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to render diagram");
      }

      const blob = await response.blob();
      const svgUrl = URL.createObjectURL(blob);
      setDiagramSvg(svgUrl);
    } catch (err) {
      console.error("Error rendering PlantUML:", err);
      setError(err.message || "Failed to render diagram");
      setDiagramSvg(null);
      toast({
        title: "Rendering Error",
        description: err.message || "Failed to render PlantUML diagram",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEdit = () => {
    if (isEditMode) {
      // switching from edit to view - render the diagram
      renderDiagram(plantUmlCode);
    }
    setIsEditMode(!isEditMode);
  };

  const handleCodeChange = (e) => {
    setPlantUmlCode(e.target.value);
  };

  // clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (diagramSvg) {
        URL.revokeObjectURL(diagramSvg);
      }
    };
  }, [diagramSvg]);

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden" bg="white">
      {/* toolbar */}
      <Box flexShrink={0} p={2} borderBottom="1px" borderColor="gray.200">
        <HStack spacing={2} justify="space-between">
          <Text fontWeight="semibold" fontSize="sm" color="gray.700">
            {isEditMode ? "Edit PlantUML Code" : "UML Diagram"}
          </Text>
          <IconButton
            icon={isEditMode ? <ViewIcon /> : <EditIcon />}
            onClick={handleToggleEdit}
            size="sm"
            aria-label={isEditMode ? "View Diagram" : "Edit Code"}
            variant="ghost"
          />
        </HStack>
      </Box>

      {/* content area */}
      <Box flex="1" minHeight={0} overflow="auto" position="relative">
        {isEditMode ? (
          <Textarea
            value={plantUmlCode}
            onChange={handleCodeChange}
            placeholder="Enter PlantUML code here..."
            fontFamily="monospace"
            fontSize="sm"
            resize="none"
            width="100%"
            height="100%"
            border="none"
            p={4}
            _focus={{ border: "none", boxShadow: "none" }}
          />
        ) : (
          <Box width="100%" height="100%" position="relative">
            {isLoading ? (
              <Center height="100%">
                <Spinner size="xl" color="blue.500" />
              </Center>
            ) : error ? (
              <Center height="100%">
                <Text color="red.500">{error}</Text>
              </Center>
            ) : diagramSvg ? (
              <Box
                width="100%"
                height="100%"
                overflow="auto"
                p={4}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Box
                  as="img"
                  src={diagramSvg}
                  alt="PlantUML Diagram"
                  maxWidth="100%"
                  maxHeight="100%"
                  objectFit="contain"
                />
              </Box>
            ) : (
              <Center height="100%">
                <Text color="gray.500">No diagram to display</Text>
              </Center>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PlantUmlTab;
