package com.aurelis.store.controller;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String,String>> response(ResponseStatusException e){return ResponseEntity.status(e.getStatusCode()).body(Map.of("error",String.valueOf(e.getReason())));}
  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String,String>> fallback(Exception e){return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error","Server unavailable."));}
}
