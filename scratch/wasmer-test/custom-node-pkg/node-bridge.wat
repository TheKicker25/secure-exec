(module
  ;; WASI imports
  (import "wasi_snapshot_preview1" "fd_write"
    (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit"
    (func $proc_exit (param i32)))
  (import "wasi_snapshot_preview1" "args_get"
    (func $args_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "args_sizes_get"
    (func $args_sizes_get (param i32 i32) (result i32)))

  (memory (export "memory") 1)

  ;; Message: "[node-bridge] This is a stub for Node.js execution\n"
  (data (i32.const 0) "[node-bridge] This is a stub for Node.js execution\n")
  ;; iov structure at 100: ptr=0, len=51
  (data (i32.const 100) "\00\00\00\00\33\00\00\00")
  ;; nwritten at 200
  (data (i32.const 200) "\00\00\00\00")

  ;; Message2: "[node-bridge] Would forward to real Node.js here\n"
  (data (i32.const 300) "[node-bridge] Would forward to real Node.js here\n")
  ;; iov2 at 400
  (data (i32.const 400) "\2c\01\00\00\31\00\00\00")

  ;; Args buffer at 500+
  (data (i32.const 500) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")

  (func (export "_start")
    ;; Write first message
    i32.const 1      ;; stdout
    i32.const 100    ;; iovs
    i32.const 1      ;; iovs_len
    i32.const 200    ;; nwritten
    call $fd_write
    drop

    ;; Write second message
    i32.const 1      ;; stdout
    i32.const 400    ;; iovs
    i32.const 1      ;; iovs_len
    i32.const 200    ;; nwritten
    call $fd_write
    drop

    ;; Exit 0
    i32.const 0
    call $proc_exit
  )
)
