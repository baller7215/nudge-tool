import React from "react";
import { Button, Badge } from "@chakra-ui/react";
import { FiChevronsRight, FiChevronsLeft } from "react-icons/fi";

const ToggleCardsButton = ({ show, count, onClick }) => (
  <Button
    onClick={onClick}
    borderRadius="xl"
    boxShadow="md"
    bg="white"
    p={0}
    minW={0}
    width="44px"
    height="44px"
    position="relative"
    _hover={{ boxShadow: "lg", bg: "gray.50" }}
  >
    {show ? <FiChevronsRight size={28} /> : <FiChevronsLeft size={28} />}
    <Badge
      position="absolute"
      top={1}
      right={1}
      bg="#FFD8E4"
      color="black"
      borderRadius="full"
      px={2}
      fontSize="sm"
      fontWeight="bold"
      boxShadow="sm"
    >
      {count}
    </Badge>
  </Button>
);

export default ToggleCardsButton;

